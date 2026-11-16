import { execFile } from "node:child_process";
import { appendFileSync } from "node:fs";
import { ipcMain, shell } from "electron";
import { BRANCH_CHANNEL, OPEN_REF_CHANNEL, REFS_CHANNEL } from "../../shared/api";
import { gitBranch } from "./branch";
import { ghRefs, readCwd, RefCache } from "./gh";

/** The folder of the agent's repository: CONTR_REPO_DIR, else the hc terminal's cwd (read-only `hc get --json`). */
function repoDir(terminal: string, hc = process.env.CONTR_HC ?? "hc"): Promise<string | null> {
  if (process.env.CONTR_REPO_DIR) return Promise.resolve(process.env.CONTR_REPO_DIR);
  return new Promise((resolve) => {
    execFile(hc, ["get", "--json", terminal], { timeout: 5000 }, (_error, stdout) => resolve(readCwd(String(stdout ?? ""))));
  });
}

/** PR and issue states for the chat's chips, and the click that opens one in the browser. */
export function registerRefsIpc(terminal: string): void {
  let dir: Promise<string | null> | undefined;
  const cache = new RefCache(async (numbers) => {
    dir ??= repoDir(terminal);
    const cwd = await dir;
    return cwd ? ghRefs(cwd, numbers) : new Map();
  });
  ipcMain.handle(REFS_CHANNEL, (_event, numbers: unknown) =>
    cache.get(Array.isArray(numbers) ? numbers.filter((n): n is number => Number.isInteger(n) && n > 0) : []),
  );
  ipcMain.handle(BRANCH_CHANNEL, async () => {
    const cwd = await repoDir(terminal);
    return cwd ? gitBranch(cwd) : null;
  });
  ipcMain.handle(OPEN_REF_CHANNEL, (_event, url: unknown) => {
    if (typeof url !== "string" || !url.startsWith("https://")) return;
    // e2e runs never open the owner's browser: they write the URL to CONTR_OPEN_LOG.
    if (process.env.CONTR_E2E === "1") appendFileSync(process.env.CONTR_OPEN_LOG ?? "/dev/null", `${url}\n`);
    else void shell.openExternal(url);
  });
}
