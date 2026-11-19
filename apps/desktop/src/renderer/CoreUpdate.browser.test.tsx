import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { shoot } from "../../test/274-chat";
import { coreState, footer, mountSettings, settings } from "../../test/282-settings";

const card = () => settings().getByRole("region", { name: "Core" });
const newest = () => card().getByLabelText("Newest core version");
const check = () => card().getByRole("button", { name: "Check now" });
const update = () => card().getByRole("button", { name: "Update", exact: true });
const dot = () => footer().getByLabelText("Update ready");

test("a newer core shows its stamp, folder, Update button and dot", async () => {
  const { coreUpdate, checkCore } = await mountSettings({ app: { dev: true }, core: {} });
  await expect.poll(() => checkCore.mock.calls).toEqual([[false]]);
  coreUpdate.publish({ latest: "ccccccc 2026-11-20", available: true, checked: Date.now() });
  await expect.element(dot()).toBeVisible();
  await expect.element(card().getByLabelText("Core version", { exact: true })).toHaveTextContent("bbbbbbb 2026-11-17");
  await expect.element(newest()).toHaveTextContent("ccccccc 2026-11-20");
  await expect.element(update()).toBeVisible();
  await expect.element(card().getByLabelText("Core folder")).toHaveTextContent("/fake/core");
  await shoot("core-newer");
});

test("a check for the same core shows Up to date without an Update action", async () => {
  const { coreUpdate, checkCore } = await mountSettings({ app: { dev: true }, core: {} });
  await check().click();
  expect(checkCore.mock.calls).toEqual([[false], [true]]);
  coreUpdate.publish({ latest: coreState.current, checked: Date.now() });
  await expect.element(newest()).toHaveTextContent("Up to date");
  await expect.element(card().getByLabelText("Last core check")).toHaveTextContent("Checked just now");
  await expect.element(update()).not.toBeInTheDocument();
  await expect.element(dot()).not.toBeInTheDocument();
  await shoot("core-same");
});

test("a failed core check shows its message and Unknown and can be tried again", async () => {
  const { coreUpdate } = await mountSettings({ app: { dev: true }, core: {} });
  await expect.element(check()).toBeEnabled();
  coreUpdate.publish({ error: "Core check failed: fake http", checkFailed: true, checked: Date.now() });
  await expect.element(card().getByRole("alert")).toHaveTextContent("Core check failed: fake http");
  await expect.element(newest()).toHaveTextContent("Unknown");
  await expect.element(card().getByText("Up to date")).not.toBeInTheDocument();
  await expect.element(check()).toBeEnabled();
  await shoot("core-failed");
});

test("a shared root shows the Herdr notice and the bundled stamp without actions", async () => {
  await mountSettings({ app: { dev: true }, core: { shared: true, source: "bundle", current: "aaaaaaa 2026-11-10" } });
  await expect.element(card().getByRole("status")).toHaveTextContent(
    "The Herdr app uses this core. contr runs its own copy and does not change this folder.",
  );
  await expect.element(card().getByLabelText("Core version", { exact: true })).toHaveTextContent("aaaaaaa 2026-11-10");
  await expect.element(check()).not.toBeInTheDocument();
  await expect.element(update()).not.toBeInTheDocument();
  await expect.element(dot()).not.toBeInTheDocument();
  await shoot("core-shared");
});

test("without a core root, the Core part shows Development build without a folder or check", async () => {
  await mountSettings({ app: { dev: true } });
  await expect.element(newest()).toHaveTextContent("Development build");
  await expect.element(check()).not.toBeInTheDocument();
  await expect.element(page.getByLabelText("Core folder")).not.toBeInTheDocument();
  await shoot("core-dev");
});
