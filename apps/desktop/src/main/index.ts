import { app, BrowserWindow } from "electron";
import path from "node:path";
import { chatTerminal, setupHelper } from "./helper";
import { registerCoreIpc } from "./core/ipc";
import { startCore } from "./core/start";
import { handleImageScheme, registerImageScheme } from "./localImages";
import { registerBoardIpc } from "./board/ipc";
import { registerDigestIpc } from "./digest/ipc";
import { registerPrCardIpc } from "./prcard/ipc";
import { registerRefsIpc } from "./refs/ipc";
import { registerSidebarIpc } from "./sidebar/ipc";
import { registerFootIpc } from "./foot/ipc";
import { inboxBadge, registerOwnerIpc } from "./owner/ipc";
import { windowTitle } from "./owner/owner";
import { registerSettingsIpc } from "./settings/ipc";
import { registerUpdateIpc } from "./update/ipc";
import { setAppMenu } from "./menu";
import { registerTerminalIpc } from "./terminal/ipc";
import { windowOptions } from "./window-options";
import { syncShellPath } from "./shell/path";
import { guardLinks, openExternal } from "./links";

/** e2e runs set CONTR_E2E=1: the window never shows, so it takes neither the owner's focus nor the screen. */
const e2e = process.env.CONTR_E2E === "1";

// Before any hc, gh, helper or orch call: an app opened from Finder has the short macOS PATH.
if (app.isPackaged && !e2e) console.log(`contr: PATH=${syncShellPath()}`);

function createWindow(): void {
  const win = new BrowserWindow(
    windowOptions(process.platform, path.join(__dirname, "../preload/index.cjs"), e2e),
  );
  // The title is the main process's: it carries the Inbox count, so the page's <title> does not replace it.
  win.setTitle(windowTitle(inboxBadge));
  win.on("page-title-updated", (e) => e.preventDefault());
  if (!e2e) win.once("ready-to-show", () => win.show());
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(path.join(__dirname, "../renderer/index.html"));
}

registerImageScheme();
// Each window: no new window and no navigation away from the app's page; web and mail links go to the system.
app.on("web-contents-created", (_event, contents) => guardLinks(contents, openExternal));

void app.whenReady().then(async () => {
  handleImageScheme();
  if (e2e && process.platform === "darwin") app.setActivationPolicy("accessory");
  // The core's root and copy (home or bundle) come before any helper or tool call.
  const core = await startCore(app.getAppPath(), app.isPackaged);
  setupHelper(app.getAppPath());
  registerTerminalIpc();
  registerRefsIpc(chatTerminal);
  registerBoardIpc(app.getAppPath(), chatTerminal);
  registerDigestIpc(app.getAppPath(), chatTerminal);
  registerSidebarIpc(app.getAppPath());
  registerFootIpc(app.getAppPath());
  registerOwnerIpc(app.getAppPath());
  registerSettingsIpc(app.getAppPath());
  setAppMenu(registerUpdateIpc().check, e2e);
  registerCoreIpc(app.getAppPath(), core);
  registerPrCardIpc(app.getAppPath(), chatTerminal);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
