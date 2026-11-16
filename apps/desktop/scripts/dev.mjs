// Dev runner: Vite dev server for the renderer, esbuild watch for main and
// preload, and Electron, restarted when main or preload change.
import { spawn } from "node:child_process";
import { watch } from "node:fs";
import electron from "electron";
import { createServer } from "vite";
import { buildMain } from "./build.mjs";

const server = await createServer();
await server.listen();
const url = server.resolvedUrls.local[0];
await buildMain(true);

let child;
function start() {
  child = spawn(String(electron), ["."], {
    stdio: "inherit",
    env: { ...process.env, VITE_DEV_SERVER_URL: url },
  });
  child.on("exit", (code, signal) => {
    if (signal !== "SIGTERM") shutdown(code ?? 0);
  });
}

let timer;
watch("out", { recursive: true }, () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    child.kill("SIGTERM");
    start();
  }, 200);
});

async function shutdown(code) {
  await server.close();
  process.exit(code);
}
process.on("SIGINT", () => {
  child?.kill("SIGTERM");
  void shutdown(0);
});

start();
