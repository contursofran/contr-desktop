// Vite reloads the renderer. Only a successful main or preload build restarts Electron.
import { spawn } from "node:child_process";
import { once } from "node:events";
import electron from "electron";
import { createServer } from "vite";
import { watchMain } from "./build.mjs";

const server = await createServer();
await server.listen();
const url = server.resolvedUrls.local[0];
let child;
let stopping = false;

async function stopChild() {
  const previous = child;
  child = undefined;
  if (previous) {
    const exited = once(previous, "exit");
    previous.kill("SIGTERM");
    await exited;
  }
}

const build = await watchMain(async () => {
  await stopChild();
  if (stopping) return;
  const next = spawn(String(electron), ["."], {
    stdio: "inherit",
    env: { ...process.env, VITE_DEV_SERVER_URL: url },
  });
  child = next;
  next.once("exit", (code) => {
    if (child === next) {
      child = undefined;
      void shutdown(code ?? 0);
    }
  });
});

async function shutdown(code) {
  if (stopping) return;
  stopping = true;
  await stopChild();
  await build.dispose();
  await server.close();
  process.exitCode = code;
}

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));
