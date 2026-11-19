import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import type { HealthCheck, HealthReport } from "../../shared/api";
import { useCopy } from "../chat/markdown/useCopy";
import { buttonClass, Group, Row } from "./rows";

const names: Record<string, string> = {
  helper: "Helper", root: "Core folder", hc: "hc core", orch: "Orchestration tool", kit: "Claude Code kit",
  agents: "Agent profiles", codex: "Codex", logs: "Session logs", git: "Git", gh: "GitHub CLI",
  connection: "Connection", machines: "Machines", usage: "Plan usage", release: "Update source",
};
const states = { ok: "Pass", warn: "Warning", fail: "Failed" } as const;
const nameOf = (id: string) => Object.hasOwn(names, id) ? names[id] : id;

function reportText(report: HealthReport): string {
  return [`contr health · ${new Date(report.checked).toISOString()}`, ...report.machines.map(({ name, checks }) => [name,
    ...checks.map((check) => `${states[check.state]} · ${nameOf(check.id)} · ${check.message}${check.fix ? `\n  ${check.fix}` : ""}`),
  ].join("\n"))].join("\n\n");
}

export function HealthView() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState(false);
  const { copy, copied } = useCopy();
  useEffect(() => {
    let live = true;
    void window.contr.checkHealth().then((value) => {
      if (live) setReport(value);
    }, () => {
      if (live) setError(true);
    }).finally(() => {
      if (live) setChecking(false);
    });
    return () => { live = false; };
  }, []);
  const run = () => {
    setChecking(true);
    setError(false);
    void window.contr.checkHealth().then(setReport, () => setError(true)).finally(() => setChecking(false));
  };
  const checks = report?.machines.flatMap((machine) => machine.checks) ?? [];
  const count = (state: HealthCheck["state"]) => checks.filter((check) => check.state === state).length;
  const warnings = count("warn");
  return (
    <section aria-label="Health check">
      <Group title="Health check" aside={
        <>
          {report && <time dateTime={new Date(report.checked).toISOString()} className="font-mono text-[11px] text-dim">{new Date(report.checked).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>}
          <button type="button" className={buttonClass()} disabled={checking} onClick={run}>{checking ? "Checking…" : "Run again"}</button>
          <button type="button" className={buttonClass()} disabled={!report} onClick={() => report && copy(reportText(report))}>{copied ? "Copied" : "Copy report"}</button>
        </>
      }>
        {error && <Row><span role="alert" className="text-error">The health check failed to run.</span></Row>}
        {report && <>
          <Row><span role="status" className="font-mono text-[11.5px] text-ink-85">{count("ok")} of {checks.length} pass · {warnings} {warnings === 1 ? "warning" : "warnings"} · {count("fail")} failed</span></Row>
          {report.machines.map(({ name, checks }) => (
            <section key={name} aria-label={name}>
              <h3 className="border-b border-hairline px-1 pt-3 pb-2 text-xs font-medium text-dim">{name}</h3>
              {checks.map((check) => <CheckRow key={check.id} check={check} />)}
            </section>
          ))}
        </>}
      </Group>
    </section>
  );
}

function CheckRow({ check }: { check: HealthCheck }) {
  const { copy, copied } = useCopy();
  const label = nameOf(check.id);
  const body = <>
    <span className="mr-auto shrink-0">{label}</span>
    <span className="min-w-0 text-right font-mono text-[11.5px] break-words text-muted">{check.message}</span>
    <span className={`min-w-14 text-right text-[11px] ${check.state === "fail" ? "text-error" : "text-dim"}`}>{states[check.state]}</span>
    {check.fix ? <ChevronDown aria-hidden className="size-3 shrink-0 text-dim group-open:rotate-180" /> : <span aria-hidden className="size-3 shrink-0" />}
  </>;
  if (!check.fix) return <Row>{body}</Row>;
  return (
    <details className="group border-b border-hairline">
      <summary className="flex min-h-[38px] cursor-pointer list-none items-center gap-3 px-1 py-1.5 text-[13px] text-ink-85 hover:bg-hover" aria-label={`${label} · ${states[check.state]}`}>
        {body}
      </summary>
      <div className="flex items-center gap-3 px-1 pb-2 text-xs text-muted">
        <span className="grow">{check.fix}</span>
        <button type="button" className={buttonClass()} onClick={() => copy(check.fix)}>{copied ? "Copied" : "Copy fix"}</button>
      </div>
    </details>
  );
}
