import { BrowserWindow, ipcMain } from "electron";
import { MACHINES_CHANNEL, USAGE_CHANNEL, USAGE_EVENT, type UsageRow } from "../../shared/api";
import { helperPath, runHelper } from "../helper/run";
import { run } from "../sidebar/agents";
import { parseMachines, usageRows } from "./usage";

/** The plan usage has no event: the helper's `usage` is read at start and every 5 minutes (docs/design/recipe-herdr.md). */
const USAGE_POLL_MS = 5 * 60_000;

/** The sidebar's head and foot: hc's machines and the plan usage. */
export function registerFootIpc(appRoot: string): void {
  const helper = helperPath(appRoot);
  const hc = process.env.CONTR_HC ?? "hc";
  let last: UsageRow[] = [];
  const read = async () => {
    last = usageRows(await runHelper(helper, ["usage"]), Date.now() / 1000);
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send(USAGE_EVENT, last);
  };
  void read();
  setInterval(() => void read(), USAGE_POLL_MS);
  ipcMain.handle(USAGE_CHANNEL, () => last);
  ipcMain.handle(MACHINES_CHANNEL, async () => parseMachines(await run(hc, ["machine", "ls", "--json"])));
}
