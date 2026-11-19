import { createHash } from "node:crypto";
import { watch, type FSWatcher } from "node:fs";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { hcCommand, runHcTerminal } from "../terminal/hc-command";

const LABEL = "contr.codex.thread";

export function codexCoordinatorName(threadId: string): string {
  return "contr-codex-" + createHash("sha256").update(threadId).digest("hex").slice(0, 20);
}

export class Coordinator {
  private watcher?: FSWatcher;
  private starting?: Promise<string>;
  private readonly dir: string;

  constructor(root: string, private readonly threadId: string, private readonly cwd: string) {
    this.dir = join(root, threadId);
  }

  async follow(changed: () => void) {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    this.watcher ??= watch(this.dir, { persistent: false }, (_event, file) => {
      if (file?.endsWith(".report")) changed();
    });
    this.watcher.on("error", (error) => console.warn("Codex report watcher:", error.message));
    changed();
  }

  close() {
    this.watcher?.close();
  }

  async firstReport() {
    const file = (await readdir(this.dir)).sort().find((name) => name.endsWith(".report"));
    if (!file) return;
    const path = join(this.dir, file);
    return { text: await readFile(path, "utf8"), delivered: () => rm(path, { force: true }) };
  }

  parent(create: true): Promise<string>;
  parent(create?: false): Promise<string | undefined>;
  async parent(create = false): Promise<string | undefined> {
    if (this.starting) return this.starting;
    const result = await hcCommand<{ terminals: { address: string; state: string; name: string }[] }>(
      "terminal.list", { labels: { [LABEL]: this.threadId } },
    );
    const existing = result.terminals.find((t) => t.state === "live" && t.name === codexCoordinatorName(this.threadId));
    if (existing || !create) return existing?.address;
    this.starting ??= this.start().finally(() => { this.starting = undefined; });
    return this.starting;
  }

  private async start() {
    const ready = join(this.dir, "ready");
    await rm(ready, { force: true });
    const address = await runHcTerminal({
      argv: [process.execPath, join(__dirname, "report-terminal.cjs"), this.dir],
      cwd: this.cwd,
      env: { ELECTRON_RUN_AS_NODE: "1" },
      name: codexCoordinatorName(this.threadId),
      labels: { [LABEL]: this.threadId },
      no_parent: true,
      no_notify: true,
    });
    try {
      await waitForReady(this.dir, ready, address);
      return address;
    } catch (error) {
      await hcCommand("terminal.kill", { terminal: address }).catch(() => undefined);
      throw error;
    }
  }
}

async function waitForReady(dir: string, file: string, address: string) {
  let watcher: FSWatcher | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      const check = () => {
        void readFile(file, "utf8").then((text) => {
          if (text === address) resolve();
        }).catch(() => undefined);
      };
      watcher = watch(dir, { persistent: false }, check);
      watcher.once("error", reject);
      timeout = setTimeout(() => reject(new Error("The Codex coordinator did not start in hc.")), 5_000);
      check();
    });
  } finally {
    clearTimeout(timeout);
    watcher?.close();
  }
}
