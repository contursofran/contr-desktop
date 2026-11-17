// The verify skill's script (.claude/skills/verify/SKILL.md): it starts the app hidden through launch.ts with the fakes,
// keeps it in a background process, and runs one command for each call. Run it with `node e2e/verify.ts <command>`.
import type { ElectronApplication, Locator, Page } from "@playwright/test";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const e2e = import.meta.dirname;
const desk = path.resolve(e2e, "..");
const root = path.resolve(desk, "../..");
const shots = path.join(root, "tmp/shots");
// VERIFY_SESSION: the folder of the session file (a test uses its own). It is a switch of this script, not of the app.
const sessionDir = process.env.VERIFY_SESSION ?? path.join(root, "tmp/verify");
const sessionFile = path.join(sessionDir, "session.json");
const idleMs = 30 * 60_000;

/** The programs the app runs. Each is a fake in e2e/ unless the caller names another file in e2e/ or tmp/. */
const programs: Record<string, string> = {
  CONTR_HELPER: "fake-helper.mjs",
  CONTR_HC: "fake-hc.mjs",
  CONTR_ORCH: "fake-orch.mjs",
  CONTR_GIT: "fake-git.mjs",
  CONTR_GH: "fake-gh.mjs",
};

/** The app's environment from `KEY=VALUE` words; `fixture=<name>` is a file in e2e/fixtures (or a path), `size=WxH` is kept apart. */
export function startEnv(words: string[], data: string): { env: Record<string, string>; size?: string } {
  const env: Record<string, string> = {
    ...Object.fromEntries(Object.entries(programs).map(([k, f]) => [k, path.join(e2e, f)])),
    FAKE_HELPER_FIXTURE: path.join(e2e, "fixtures/claude-session.jsonl"),
    FAKE_HELPER_SEND_LOG: path.join(data, "send.log"),
    FAKE_HC_AGENTS: "1",
    FAKE_GIT_BRANCH: "main",
    CONTR_TERMINAL: "t7",
    CONTR_OPEN_LOG: path.join(data, "open.log"),
  };
  let size: string | undefined;
  for (const word of words) {
    const at = word.indexOf("=");
    if (at < 1) throw new Error(`not KEY=VALUE: ${word}`);
    const [key, value] = [word.slice(0, at), word.slice(at + 1)];
    if (key === "size") size = value;
    else if (key === "fixture") env.FAKE_HELPER_FIXTURE = value.includes("/") ? path.resolve(value) : path.join(e2e, "fixtures", value.endsWith(".jsonl") ? value : `${value}.jsonl`);
    else if (key in programs) {
      const file = path.resolve(value);
      if (![e2e, path.join(root, "tmp")].some((dir) => file.startsWith(dir + path.sep))) throw new Error(`${key} must be a fake in e2e/ or tmp/: ${value}`);
      env[key] = file;
    } else env[key] = value;
  }
  return { env, size };
}

/** Builds the app when out/ is missing or older than a file in src/. */
function build() {
  const out = path.join(desk, "out/main/index.cjs");
  const newest = (dir: string): number => Math.max(0, ...readdirSync(dir, { withFileTypes: true }).map((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? newest(p) : statSync(p).mtimeMs;
  }));
  if (existsSync(out) && statSync(out).mtimeMs >= newest(path.join(desk, "src"))) return;
  const done = spawnSync("pnpm", ["build"], { cwd: desk, stdio: ["ignore", process.stderr, process.stderr] });
  if (done.status !== 0) throw new Error("pnpm build failed");
}

/** A locator from role and name pairs, each inside the one before: `navigation Projects button "Release notes draft"`. */
function find(page: Page, words: string[]): Locator {
  let at: Page | Locator = page;
  for (let i = 0; i < words.length; i += 2) at = at.getByRole(words[i] as Parameters<Page["getByRole"]>[0], words[i + 1] === undefined ? {} : { name: words[i + 1] });
  return at === page ? page.locator("body") : (at as Locator);
}

/** The background process: it starts the app, then answers one command for each HTTP request on 127.0.0.1. */
async function serve(words: string[]) {
  for (const key of Object.keys(process.env)) if (/^(CONTR_|FAKE_|HC_SESSION$)/.test(key)) delete process.env[key];
  const data = mkdtempSync(path.join(os.tmpdir(), "contr-verify-data-"));
  const { env, size } = startEnv(words, data);
  const launch = "./launch.ts";
  const { launchApp } = (await import(launch)) as typeof import("./launch");
  const app: ElectronApplication = await launchApp(env, data);
  const log: string[] = [];
  for (const stream of [app.process().stdout, app.process().stderr]) stream?.on("data", (d: Buffer) => log.push(...d.toString().split("\n").filter(Boolean)));
  const page = await app.firstWindow();
  page.setDefaultTimeout(10_000);
  page.on("console", (m) => log.push(`[page ${m.type()}] ${m.text()}`));
  const setSize = async (value: string) => {
    const [w, h] = value.split("x").map(Number);
    await app.evaluate(({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0]!.setContentSize(w!, h!), [w, h]);
    await page.waitForFunction(([w, h]) => innerWidth === w && innerHeight === h, [w, h]);
    return `${w}x${h}`;
  };
  if (size) await setSize(size);
  const stop = async () => {
    await app.close();
    rmSync(data, { recursive: true, force: true });
    rmSync(sessionFile, { force: true });
    return "stopped";
  };
  const commands: Record<string, (args: string[]) => Promise<string>> = {
    title: async () => page.title(),
    size: async ([value]) => setSize(value!),
    theme: async ([scheme]) => (await page.emulateMedia({ colorScheme: scheme as "dark" | "light" }), scheme!),
    press: async (keys) => { for (const k of keys) await page.keyboard.press(k); return keys.join(" "); },
    type: async ([text]) => (await page.keyboard.type(text!), text!),
    click: async (args) => (await find(page, args).click(), "clicked"),
    text: async (args) => find(page, args).innerText(),
    roles: async (args) => find(page, args).ariaSnapshot(),
    shot: async ([name]) => {
      mkdirSync(shots, { recursive: true });
      const file = path.join(shots, `${name ?? "verify"}.png`);
      await page.screenshot({ path: file });
      return file;
    },
    log: async () => log.join("\n"),
    stop,
  };
  // A session that gets no command for 30 minutes stops, so a forgotten one does not stay.
  const quit = () => stop().then(() => process.exit(0));
  let idle = setTimeout(quit, idleMs);
  let queue = Promise.resolve();
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => (queue = queue.then(async () => {
      clearTimeout(idle);
      idle = setTimeout(quit, idleMs);
      const [cmd, ...args] = JSON.parse(body) as string[];
      const run = commands[cmd!];
      let reply;
      try {
        if (!run) throw new Error(`unknown command ${cmd}; commands: start ${Object.keys(commands).join(" ")}`);
        reply = { ok: true, out: await run(args) };
      } catch (e) {
        reply = { ok: false, out: String(e instanceof Error ? e.message : e) };
      }
      res.end(JSON.stringify(reply), () => cmd === "stop" && process.exit(0));
    })));
  });
  server.listen(0, "127.0.0.1", () => {
    const { port } = server.address() as { port: number };
    writeFileSync(sessionFile, JSON.stringify({ port, pid: process.pid }));
    process.stdout.write("ready\n");
  });
}

/** `start`: builds if needed, then runs `serve` in the background and waits for its "ready" line. Its errors go to serve.log. */
async function start(words: string[]) {
  if (existsSync(sessionFile)) throw new Error(`a session runs (${sessionFile}): stop it first`);
  startEnv(words, os.tmpdir());
  build();
  mkdirSync(sessionDir, { recursive: true });
  const errors = path.join(sessionDir, "serve.log");
  const child = spawn(process.execPath, [import.meta.filename, "serve", ...words], { detached: true, stdio: ["ignore", "pipe", openSync(errors, "w")] });
  let out = "";
  const ready = await new Promise<boolean>((done) => {
    child.stdout!.on("data", (d) => {
      out += d;
      if (out.split("\n").includes("ready")) done(true);
    });
    child.once("exit", () => done(false));
  });
  if (!ready) throw new Error(`the app did not start:\n${out}${readFileSync(errors, "utf8")}`);
  child.stdout!.destroy();
  child.unref();
  return "started";
}

/** Sends one command to the running session. */
async function send(words: string[]): Promise<string> {
  if (!existsSync(sessionFile)) throw new Error("no session: run `start` first");
  const { port } = JSON.parse(readFileSync(sessionFile, "utf8")) as { port: number };
  const reply = await new Promise<string>((done, fail) => {
    const req = http.request({ host: "127.0.0.1", port, method: "POST" }, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => done(body));
    });
    req.on("error", (e) => fail(new Error(`the session does not answer (${e.message}); delete ${sessionFile} if it is gone`)));
    req.end(JSON.stringify(words));
  });
  const { ok, out } = JSON.parse(reply) as { ok: boolean; out: string };
  if (!ok) throw new Error(out);
  return out;
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "serve") await serve(rest);
else {
  try {
    console.log(cmd === "start" ? await start(rest) : await send([cmd ?? "", ...rest]));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  }
}
