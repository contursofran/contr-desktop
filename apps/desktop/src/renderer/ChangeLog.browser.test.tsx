import { expect, test, vi } from "vitest";
import { commands, page } from "vitest/browser";
import releases from "../../e2e/fixtures/releases.json";
import { mountSettings } from "../../test/282-settings";
import { shoot } from "../../test/274-chat";
import type { ChangeLog } from "../shared/api";

const log = () => page.getByRole("region", { name: "Change log" });
const release = (version: string) => log().getByRole("listitem", { name: `contr ${version}` });
const fixture: ChangeLog = {
  // The bridge returns the releases in display order. Electron checks how main orders the raw fixture.
  releases: ["0.1.27", "0.1.26", "0.1.25", "0.1.24", "0.1.23", "0.1.22"].map((version) => {
    const raw = releases.find(({ body }) => body.startsWith(`contr ${version} from `))!;
    const notes = raw.body.split("\n## Changes\n\n")[1]?.split("\n\n")[0];
    return {
      version,
      tag: raw.tag_name,
      date: raw.published_at.slice(0, 10),
      changes: notes?.split("\n").map((line) => line.slice(2)) ?? [],
    };
  }),
  error: null,
};

test("the change log lists dates, labels and notes, with older releases behind Show older", async () => {
  await mountSettings({ app: { current: "0.1.24", dev: true }, overrides: { changeLog: async () => fixture } });
  const dates = log().getByLabelText("Date");
  await expect.element(dates).toHaveLength(3);
  expect(dates.elements().map((date) => date.textContent)).toEqual(["2026-11-17", "2026-11-16", "2026-11-16"]);
  const newest = release("0.1.27");
  await expect.element(newest.getByLabelText("Mark")).toHaveTextContent("New");
  expect(newest.getByRole("listitem").elements().map((item) => item.textContent)).toEqual([
    "Error and empty states: helper error as a block in the column (Fixes #99) (#110)",
    "Keys: card keys stay text in fields and menus (Fixes #101) (#109)",
    "Light theme: dim text reaches 4.5:1 (Fixes #102) (#106)",
  ]);
  await expect.element(log().getByRole("link")).toHaveLength(0);
  await expect.element(release("0.1.25").getByLabelText("Mark")).toHaveTextContent("New");
  await expect.element(release("0.1.24")).not.toBeInTheDocument();
  log().element().scrollIntoView({ block: "nearest" });
  await shoot("changelog-dark", false);

  const older = log().getByRole("button", { name: "Show older" });
  await older.click();
  await expect.element(older).not.toBeInTheDocument();
  expect(Array.from(log().element().querySelectorAll("ol > li"), (item) => item.getAttribute("aria-label"))).toEqual([
    "contr 0.1.27", "contr 0.1.26", "contr 0.1.25", "contr 0.1.24", "contr 0.1.23", "contr 0.1.22",
  ]);
  const installed = release("0.1.24");
  await expect.element(installed.getByLabelText("Mark")).toHaveTextContent("Installed");
  await expect.element(installed.getByRole("listitem")).toHaveLength(2);
  const bare = release("0.1.23");
  await expect.element(bare.getByLabelText("Date")).toHaveTextContent("2026-11-14");
  await expect.element(bare.getByRole("list")).toHaveLength(0);
  await expect.element(bare.getByLabelText("Mark")).toHaveLength(0);
  await expect.element(release("0.1.22").getByLabelText("Mark")).toHaveLength(0);
  installed.element().scrollIntoView({ block: "nearest" });
  await shoot("changelog-older");
});

test("a pending change log shows Loading, then an error with Retry, then releases", async () => {
  let finish!: (result: ChangeLog) => void;
  const pending = new Promise<ChangeLog>((resolve) => { finish = resolve; });
  const changeLog = vi.fn((again?: boolean) => again ? Promise.resolve(fixture) : pending);
  await mountSettings({ app: { current: "0.1.24", dev: true }, overrides: { changeLog } });
  await commands.colorScheme("light");
  await expect.element(log().getByRole("status")).toHaveTextContent("Loading the change log…");
  await shoot("changelog-loading-light", false);
  finish({ releases: null, error: "Could not load the change log: HTTP 500" });
  const alert = log().getByRole("alert");
  await expect.element(alert).toHaveTextContent("Could not load the change log: HTTP 500");
  await expect.element(log().getByRole("status")).not.toBeInTheDocument();
  await expect.element(alert).toHaveStyle({ color: "rgb(20, 20, 20)" });
  await shoot("changelog-failed-light", false);
  await commands.colorScheme("dark");
  await expect.element(alert).toHaveStyle({ color: "rgb(244, 244, 245)" });
  await shoot("changelog-failed-dark", false);
  await log().getByRole("button", { name: "Retry" }).click();
  await expect.element(release("0.1.27")).toBeVisible();
  await expect.element(alert).not.toBeInTheDocument();
  expect(changeLog).toHaveBeenLastCalledWith(true);
});
