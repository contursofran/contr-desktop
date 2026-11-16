import { app, BrowserWindow } from "electron";
import path from "node:path";
import { chatTerminal, setupHelper } from "./helper";
import { handleImageScheme, registerImageScheme } from "./localImages";
import { registerBoardIpc } from "./board/ipc";
import { registerRefsIpc } from "./refs/ipc";
import { registerSidebarIpc } from "./sidebar/ipc";
import { registerFootIpc } from "./foot/ipc";
import { inboxBadge, registerOwnerIpc } from "./owner/ipc";
import { windowTitle } from "./owner/owner";
import { registerSettingsIpc } from "./settings/ipc";
import { registerUpdateIpc } from "./update/ipc";
import { registerTerminalIpc } from "./terminal/ipc";
import { windowOptions } from "./window-options";
import { syncShellPath } from "./shell/path";

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

void app.whenReady().then(() => {
  handleImageScheme();
  if (e2e && process.platform === "darwin") app.setActivationPolicy("accessory");
  setupHelper(app.getAppPath());
  registerTerminalIpc();
  registerRefsIpc(chatTerminal);
  registerBoardIpc(app.getAppPath(), chatTerminal);
  registerSidebarIpc(app.getAppPath());
  registerFootIpc(app.getAppPath());
  registerOwnerIpc(app.getAppPath());
  registerSettingsIpc(app.getAppPath());
  registerUpdateIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
