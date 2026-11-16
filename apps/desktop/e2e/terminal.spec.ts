import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { launchApp } from "./launch";

const fakeHelper = path.resolve(import.meta.dirname, "fake-helper.mjs");
const fixture = path.resolve(import.meta.dirname, "fixtures/claude-session.jsonl");

// A scratch hc core: its own short HC_SESSION (the socket path has a length limit), stopped after the test.
// Every hc command here carries it, so the owner's core is never reached.
const session = `cde${process.pid}`;
const shots = path.resolve(import.meta.dirname, "../../../tmp/shots");
const hc = (...args: string[]) =>
  execFileSync("hc", args, { env: { ...process.env, HC_SESSION: session }, encoding: "utf8" });

test.afterAll(() => {
  if (hasHc) hc("server", "stop");
});

let hasHc = true;
try {
  execFileSync("hc", ["--version"]);
} catch {
  hasHc = false;
}
// CI has no hc yet: the test runs where hc is installed.
test.skip(!hasHc, "hc is not installed");
test.setTimeout(60_000);

test("the Terminal side shows an hc terminal and sends keys to it", async () => {
  const run = JSON.parse(hc("run", "--bg", "--json", "printf 'ready\\n'; seq 1 200; exec sh")) as { address: string };
  const app = await launchApp({
    CONTR_HELPER: fakeHelper,
    FAKE_HELPER_FIXTURE: fixture,
    CONTR_HC_SESSION: session,
    // The reply box reads the title with `hc get`: it goes to the scratch core too.
    HC_SESSION: session,
    CONTR_TERMINAL: run.address,
  });
  const page = await app.firstWindow();
  await expect(page.locator("ol[aria-label=Chat] > li")).toHaveCount(15);
  await page.getByRole("button", { name: "Terminal" }).click();
  const term = page.getByTestId("terminal");
  await expect(term).toContainText("200");

  await page.keyboard.type("echo from-xterm-$((6*7))");
  await page.keyboard.press("Enter");
  await expect(term).toContainText("from-xterm-42");
  // Back and forth: the old view's listeners are gone, so each byte shows once.
  await page.getByRole("button", { name: "Chat" }).click();
  await page.getByRole("button", { name: "Terminal" }).click();
  await page.keyboard.type("echo once-$((2*3))");
  await page.keyboard.press("Enter");
  await expect(term).toContainText("once-6");
  expect((await term.innerText()).match(/once-6/g)).toHaveLength(1);
  expect(hc("read", run.address)).toContain("from-xterm-42");
  await page.screenshot({ path: path.join(shots, "terminal-shell.png") });

  // A TUI on the alternate screen, then the size follows the window.
  await page.keyboard.type("top -s 1");
  await page.keyboard.press("Enter");
  await expect(term).toContainText("PID", { timeout: 15_000 });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 560));
  await expect.poll(() => JSON.parse(hc("get", "--json", run.address)).cols as number).toBeLessThan(120);
  await page.screenshot({ path: path.join(shots, "terminal-top.png") });
  await page.keyboard.press("q");
  await app.close();
});
