import { expect, test, type Page } from "@playwright/test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchApp } from "./launch";

// An hc outage with the fake hc only: FAKE_HC_DOWN makes it fail while its file is there.
const e2e = import.meta.dirname;
const shots = path.resolve(e2e, "../../../tmp/shots");

function hcDown() {
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), "contr-e2e-hc-")), "down");
  writeFileSync(file, "");
  return file;
}

const env = {
  CONTR_TERMINAL: "",
  CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
  FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
  CONTR_HC: path.join(e2e, "fake-hc.mjs"),
  FAKE_HC_AGENTS: "1",
  FAKE_HC_CONNECT: "1",
  CONTR_GIT: path.join(e2e, "fake-git.mjs"),
};

async function shoot(page: Page, name: string) {
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: path.join(shots, `${name}-${scheme}.png`) });
  }
}

const projects = (page: Page) => page.getByRole("navigation", { name: "Projects" });
// The sidebar reads hc again at once when it is asked while hc fails (as the Retry of the hc note does), not after the 10 s poll.
const readAgain = (page: Page) => page.evaluate(() => window.contr.sidebar());

test("a restart while hc is down keeps the saved tabs; when hc is back they have their titles and a gone terminal's tab closes", async () => {
  test.setTimeout(60_000);
  const data = mkdtempSync(path.join(os.tmpdir(), "contr-e2e-data-"));
  let app = await launchApp(env, data);
  let page = await app.firstWindow();
  let tabs = page.getByRole("tablist", { name: "Tabs" }).getByRole("tab");
  await expect(tabs).toHaveText(["Chat panel usability audit", "Release notes draft"]);
  await projects(page).getByRole("button", { name: "Install health check" }).click();
  await projects(page).getByRole("button", { name: "Release notes draft" }).click();
  await expect(tabs).toHaveText(["Chat panel usability audit", "Release notes draft"]);
  await expect(page.getByRole("tab", { selected: true })).toHaveText("Release notes draft");
  // A fourth saved tab of a terminal that hc will not list (FAKE_HC_GONE: `get` fails, and `ls` does not name it).
  await page.evaluate(() => localStorage.setItem("tabs.open", JSON.stringify(["t7", "t12", "t11", "t99"])));
  await app.close();

  const down = hcDown();
  app = await launchApp({ ...env, FAKE_HC_DOWN: down, FAKE_HC_GONE: "t99" }, data);
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setContentSize(900, 600));
  tabs = page.getByRole("tablist", { name: "Tabs" }).getByRole("tab");
  await expect(projects(page).getByText("hc is not reachable", { exact: true })).toBeVisible();
  await expect(tabs).toHaveCount(4);
  expect(await page.evaluate(() => localStorage.getItem("tabs.open"))).toBe('["t7","t12","t11","t99"]');
  await shoot(page, "hc-outage-tabs-down");

  rmSync(down);
  await readAgain(page);
  await expect(projects(page).getByRole("region", { name: "contr-desktop" })).toBeVisible();
  await expect(tabs).toHaveText(["Chat panel usability audit", "Release notes draft"]);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("tabs.open") ?? "null"))).toEqual({
    projects: {
      "project:contr-desktop": { order: ["t7", "t11"], closed: [] },
      "project:herdr-contr": { order: ["t12"], closed: [] },
    },
    legacy: [],
  });
  await shoot(page, "hc-outage-tabs-back");
  await app.close();
});

test("the terminal attaches again by itself when hc comes back after an outage", async () => {
  const down = hcDown();
  const app = await launchApp({ ...env, CONTR_TERMINAL: "t7", FAKE_HC_DOWN: down });
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setContentSize(900, 600));
  await page.getByRole("radio", { name: "Terminal" }).click();
  const note = page.getByRole("alert", { name: "Terminal error" });
  await expect(note.locator("p")).toHaveText("The connection to hc ended.");
  await expect(projects(page).getByText("hc is not reachable", { exact: true })).toBeVisible();
  await shoot(page, "hc-outage-terminal-down");

  // No press on Retry: the sidebar's hcError clears, and the terminal attaches again.
  rmSync(down);
  await readAgain(page);
  await expect(note).toBeHidden();
  await expect(page.getByTestId("terminal")).toContainText("fake terminal t7 attached");
  await shoot(page, "hc-outage-terminal-back");
  await app.close();
});
