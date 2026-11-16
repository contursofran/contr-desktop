import { app, BrowserWindow } from "electron";
import path from "node:path";
import { chatTerminal, setupHelper } from "./helper";
import { handleImageScheme, registerImageScheme } from "./localImages";
import { registerBoardIpc } from "./board/ipc";
import { registerRefsIpc } from "./refs/ipc";
import { registerSidebarIpc } from "./sidebar/ipc";
import { registerTerminalIpc } from "./terminal/ipc";
import { windowOptions } from "./window-options";

/** e2e runs set CONTR_E2E=1: the app must not take the owner's focus. */
const e2e = process.env.CONTR_E2E === "1";

function createWindow(): void {
  const win = new BrowserWindow(
    windowOptions(process.platform, path.join(__dirname, "../preload/index.cjs")),
  );
  win.once("ready-to-show", () => (e2e ? win.showInactive() : win.show()));
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
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
