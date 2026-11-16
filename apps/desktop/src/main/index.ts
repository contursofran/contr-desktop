import { app, BrowserWindow } from "electron";
import path from "node:path";
import { windowOptions } from "./window-options";

function createWindow(): void {
  const win = new BrowserWindow(
    windowOptions(process.platform, path.join(__dirname, "../preload/index.cjs")),
  );
  win.once("ready-to-show", () => win.show());
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(path.join(__dirname, "../renderer/index.html"));
}

void app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
