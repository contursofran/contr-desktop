import { spawn } from "node:child_process";
import { BrowserWindow, ipcMain } from "electron";
import { SELECT_CHANNEL, SIDEBAR_CHANNEL, SIDEBAR_EVENT, type Sidebar } from "../../shared/api";
import { orchPath } from "../board/board";
import { chatTerminal, selectTerminal } from "../helper";
import { readTitle } from "../helper/title";
import { setBlockedCount } from "../owner/ipc";
import { blockedAgents } from "../../shared/inbox";
import { buildProjects, projectFromCommonDir, readHcList, readSessionFolder, run, runHcList } from "./agents";
import { faviconUrl, gitState } from "./git";

/** Without hc events (hc gone or too old), the list is read again every 10 s. */
const POLL_MS = 10_000;
/** hc events come in bursts: one read for a burst. */
const DEBOUNCE_MS = 500;
/** git has no event for a commit or a fetch: the branch and the commits ahead and behind are read again every 30 s too. */
const GIT_POLL_MS = 30_000;

/** The Projects list: agents from `hc ls --json`, each under the project of its session folder (`hc get --json`), workers' names from the orchestration tool, read again on each `hc events` line. */
export function registerSidebarIpc(appRoot: string): void {
  const hc = process.env.CONTR_HC ?? "hc";
  const git = process.env.CONTR_GIT ?? "git";
  const orch = orchPath(appRoot);
  const projects = new Map<string, Promise<string>>();
  const projectOf = (cwd: string) => {
    if (!projects.has(cwd)) projects.set(cwd, run(git, ["-C", cwd, "rev-parse", "--git-common-dir"]).then((out) => projectFromCommonDir(cwd, out.trim() || null)));
    return projects.get(cwd)!;
  };
  // A folder is looked at for a favicon once.
  const favicons = new Map<string, string | null>();
  const favicon = (cwd: string) => {
    if (!favicons.has(cwd)) favicons.set(cwd, faviconUrl(cwd));
    return favicons.get(cwd)!;
  };
  let last: Sidebar = { projects: [], selected: chatTerminal() };

  const read = async (): Promise<Sidebar> => {
    const [hcList, orchOut] = await Promise.all([runHcList(hc), run(orch, ["agents", "ls", "--all", "--json"])]);
    const list = hcList.out;
    // hc failed: no agents, and the renderer shows why.
    const { terms, error: hcError } = readHcList(list, hcList.error);
    const titles = new Map<string, string>();
    const folders = new Map<string, string>();
    await Promise.all(
      terms.map(async (t) => {
        if (typeof t.address !== "string") return;
        const got = await run(hc, ["get", "--json", t.address]);
        const title = readTitle(got, "");
        if (title) titles.set(t.address, title);
        const folder = readSessionFolder(got);
        if (folder) folders.set(t.address, folder);
      }),
    );
    const cwds = [...new Set([...terms.map((t) => t.cwd), ...folders.values()].filter((c): c is string => typeof c === "string" && c !== ""))];
    const names = new Map<string, string>();
    await Promise.all(cwds.map(async (c) => names.set(c, await projectOf(c))));
    const built = buildProjects({ hc: list, orch: orchOut, titles, folders, projectOf: (c) => names.get(c) ?? c });
    const projects = await Promise.all(built.map(async (p) => ({ ...p, ...(await gitState(git, p.cwd)), favicon: favicon(p.cwd) })));
    return { projects, selected: chatTerminal(), ...(hcError ? { hcError } : {}) };
  };

  let timer: NodeJS.Timeout | undefined;
  const refresh = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      void read().then((s) => {
        last = s;
        setBlockedCount(blockedAgents(s.projects).length);
        for (const w of BrowserWindow.getAllWindows()) w.webContents.send(SIDEBAR_EVENT, s);
      });
    }, DEBOUNCE_MS);
  };
  const follow = () => {
    const events = spawn(hc, ["events", "--json"], { stdio: ["ignore", "pipe", "ignore"] });
    events.stdout.on("data", refresh);
    events.on("error", () => undefined);
    events.on("close", () => setInterval(refresh, POLL_MS));
  };
  follow();
  refresh();
  setInterval(refresh, GIT_POLL_MS);

  // A read while hc failed (Retry) reads the list again at once; the new list comes as an event.
  ipcMain.handle(SIDEBAR_CHANNEL, () => {
    if (last.hcError) refresh();
    return { ...last, selected: chatTerminal() };
  });
  ipcMain.handle(SELECT_CHANNEL, (_event, terminal: unknown) => {
    // "" shows no agent (each tab closed): main stops the feed.
    if (typeof terminal === "string") selectTerminal(terminal);
    return chatTerminal();
  });
}
