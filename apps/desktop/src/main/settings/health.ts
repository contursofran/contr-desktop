import type { HealthCheck, HealthReport, Machine } from "../../shared/api";
import type { HelperLine } from "../helper/run";

export function helperChecks(lines: HelperLine[], remote: boolean): HealthCheck[] {
  const error = lines.find((line) => line.type === "error");
  const fix = remote ? "Check the connection and install the latest helper on this machine." : "Check the helper path or update contr-core.";
  if (error || lines[0]?.type !== "header" || lines.at(-1)?.ok !== true || lines[0].protocol !== 1) {
    return [{ id: "helper", state: "fail", message: typeof error?.message === "string" ? error.message : "No compatible health report.", fix }];
  }
  const checks: HealthCheck[] = [];
  for (const line of lines) {
    if (line.type !== "check" || typeof line.id !== "string" || typeof line.message !== "string" || typeof line.fix !== "string") continue;
    if (line.state !== "ok" && line.state !== "warn" && line.state !== "fail") continue;
    checks.push({ id: line.id, state: line.state, message: line.message, fix: line.fix });
  }
  if (!checks.some((check) => check.id === "helper")) {
    checks.unshift({ id: "helper", state: "warn", message: "The helper returned a limited health report.", fix: "Update contr-core to get the full set of checks." });
  }
  return checks;
}

export async function healthReport(
  helper: (machine?: string) => Promise<HelperLine[]>,
  machines: Promise<Machine[] | null>,
): Promise<HealthReport> {
  const [local, peers] = await Promise.all([helper(), machines]);
  const localChecks = helperChecks(local, false);
  const supportsRemote = localChecks.some((check) => check.id === "helper" && check.state === "ok");
  if (peers === null) localChecks.push({ id: "machines", state: "fail", message: "Could not read the machine list from hc.", fix: "Check hc and run hc machine ls --json." });
  const remotes = await Promise.all((peers ?? []).map(async (machine) => ({
    name: machine.name,
    checks: machine.state !== "connected"
      ? [{ id: "connection", state: "fail" as const, message: `hc reports ${machine.state}. Setup has not been checked.`, fix: "Bring this computer online and check its SSH connection in hc." }]
      : supportsRemote
        ? helperChecks(await helper(machine.name), true)
        : [{ id: "helper", state: "warn" as const, message: "Setup has not been checked.", fix: "Update the local helper to check other machines." }],
  })));
  return { checked: Date.now(), machines: [{ name: "This computer", checks: localChecks }, ...remotes] };
}
