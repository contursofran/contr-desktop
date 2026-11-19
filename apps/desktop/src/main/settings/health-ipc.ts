import { BrowserWindow, ipcMain } from "electron";
import { HEALTH_CHANNEL, HEALTH_CHECK_CHANNEL, HEALTH_EVENT, type HealthReport } from "../../shared/api";
import type { CurrentCore } from "../core/current";
import { readMachines } from "../foot/usage";
import { helperPath, runHelper } from "../helper/run";
import { run } from "../sidebar/agents";
import { healthReport } from "./health";

export function registerHealthIpc(appRoot: string, core: CurrentCore): void {
  let report: HealthReport | null = null;
  let flight: Promise<HealthReport> | null = null;
  ipcMain.handle(HEALTH_CHANNEL, () => report);
  ipcMain.handle(HEALTH_CHECK_CHANNEL, () => {
    if (flight) return flight;
    const env = core.root ? { ...process.env, CONTR_HOME: core.root, HERDR_APP_HOME: "" } : process.env;
    const helper = (machine?: string) => runHelper(helperPath(appRoot), machine ? ["health", "--machine", machine] : ["health"], { env, timeout: 40_000 });
    const machines = run(process.env.CONTR_HC ?? "hc", ["machine", "ls", "--json"]).then(readMachines);
    flight = healthReport(helper, machines).then((latest) => {
      const root = latest.machines[0].checks.find((check) => check.id === "root" && check.state === "ok");
      if (root && core.shared) root.message += " · Shared with Herdr";
      report = latest;
      for (const window of BrowserWindow.getAllWindows()) window.webContents.send(HEALTH_EVENT, latest);
      return latest;
    }).finally(() => { flight = null; });
    return flight;
  });
}
