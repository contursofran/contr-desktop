import { expect, test } from "vitest";
import { commands, page } from "vitest/browser";
import { shoot } from "../../test/274-chat";
import { footer, mountSettings, settings } from "../../test/282-settings";

const view = () => settings().getByRole("region", { name: "Updates" });
const newest = () => view().getByLabelText("Newest version");
const lastCheck = () => view().getByLabelText("Last check");
const check = () => view().getByRole("button", { name: "Check now" });
const checking = () => view().getByRole("button", { name: "Checking…" });
const action = () => view().getByRole("button", { name: "Update", exact: true });
const alert = () => view().getByRole("alert");
const status = () => view().getByRole("status");
const dot = () => footer().getByLabelText("Update ready");
const available = { latest: "9.1.42", available: true };
const checkError = "Update check failed: HTTP 500";
const opened = "Opened contr-mac-universal.dmg. Drag contr to Applications.";

test("a new release shows the versions, dot and Update action", async () => {
  const { downloadUpdate } = await mountSettings({ app: { ...available, checked: Date.now() } });
  await expect.element(dot()).toBeVisible();
  await expect.element(view().getByLabelText("Current version")).toHaveTextContent("0.0.0");
  await expect.element(newest()).toHaveTextContent("9.1.42");
  await expect.element(action()).toBeVisible();
  await shoot("update");
  await action().click();
  expect(downloadUpdate).toHaveBeenCalledOnce();
});

test("a failed first check shows its message and Unknown without a last check", async () => {
  await mountSettings({ app: { error: checkError, checkFailed: true, checked: Date.now() } });
  await expect.element(alert()).toHaveTextContent(checkError);
  await expect.element(newest()).toHaveTextContent("Unknown");
  await expect.element(lastCheck()).not.toBeInTheDocument();
  await expect.element(check()).toBeEnabled();
  await shoot("update-first-failed");
});

test("a failed download reports its error and keeps the last check", async () => {
  const { downloadUpdate, update } = await mountSettings({ app: { ...available, checked: Date.now() } });
  await action().click();
  expect(downloadUpdate).toHaveBeenCalledOnce();
  update.publish({ error: "Download failed: HTTP 500" });
  await expect.element(alert()).toHaveTextContent("Download failed: HTTP 500");
  await expect.element(lastCheck()).toHaveTextContent("Checked just now");
  await shoot("update-download-failed");
});

test("update checks show progress, preserve the known release on error and clear old results", async () => {
  const { update, checkUpdate, downloadUpdate } = await mountSettings({ app: { latest: "0.0.0", checked: Date.now() } });
  await expect.element(newest()).toHaveTextContent("Up to date");
  await expect.element(lastCheck()).toHaveTextContent("Checked just now");
  await expect.element(action()).not.toBeInTheDocument();
  await expect.element(check()).toBeEnabled();
  expect(checkUpdate).toHaveBeenCalledOnce();
  await shoot("check-uptodate");

  await check().click();
  expect(checkUpdate).toHaveBeenCalledTimes(2);
  update.publish({ checking: true });
  await expect.element(checking()).toBeDisabled();
  update.publish({ ...available, checking: false, checked: Date.now() });
  await expect.element(newest()).toHaveTextContent("9.1.42");
  await expect.element(action()).toBeVisible();
  await expect.element(dot()).toBeVisible();
  await expect.element(lastCheck()).toHaveTextContent("Checked just now");
  await shoot("check-available");

  await check().click();
  update.publish({ error: checkError, checkFailed: true, checked: Date.now() });
  await expect.element(alert()).toHaveTextContent(checkError);
  await expect.element(check()).toBeEnabled();
  await expect.element(lastCheck()).not.toBeInTheDocument();
  await expect.element(newest()).toHaveTextContent("9.1.42");
  await expect.element(action()).toBeVisible();
  await commands.colorScheme("dark");
  await expect.element(alert()).toHaveStyle({ color: "rgb(244, 244, 245)" });
  await shoot("check-failed-dark", false);
  await commands.colorScheme("light");
  await expect.element(alert()).toHaveStyle({ color: "rgb(20, 20, 20)" });
  await shoot("check-failed-light", false);

  await check().click();
  update.publish({ checking: true });
  await expect.element(checking()).toBeDisabled();
  await expect.element(alert()).not.toBeInTheDocument();
  await expect.element(lastCheck()).not.toBeInTheDocument();
  update.publish({ checking: false, checkFailed: false, error: null, checked: Date.now() });
  await expect.element(lastCheck()).toHaveTextContent("Checked just now");
  await expect.element(alert()).not.toBeInTheDocument();

  await action().click();
  expect(downloadUpdate).toHaveBeenCalledOnce();
  update.publish({ downloaded: "/fake/downloads/contr-mac-universal.dmg" });
  await expect.element(status()).toHaveTextContent(opened);
  await shoot("check-opened");
  await check().click();
  update.publish({ latest: "9.1.43", downloaded: null, checked: Date.now() });
  await expect.element(newest()).toHaveTextContent("9.1.43");
  await expect.element(status()).not.toBeInTheDocument();

  await page.getByRole("button", { name: /^Inbox\b/ }).click();
  await expect.element(view()).not.toBeInTheDocument();
  update.publish({ latest: "9.1.50" });
  await footer().click();
  await expect.element(newest()).toHaveTextContent("9.1.50");
  expect(checkUpdate).toHaveBeenCalledTimes(6);
});
