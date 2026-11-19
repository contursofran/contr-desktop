import { useState } from "react";
import type { CodexHealth } from "../../shared/api";
import { CODEX_ORCHESTRATION_RULE } from "../../shared/codex-rule";
import { useCopy } from "../chat/markdown/useCopy";
import { buttonClass, Group, PathValue, Row } from "./rows";

const LABELS: Record<CodexHealth["status"], string> = {
  present: "Rule found",
  missing: "Rule missing",
  unreadable: "Could not read file",
};

export function HealthCheck() {
  const [report, setReport] = useState<CodexHealth | "checking" | "failed">();
  const { copy, copied } = useCopy();
  const result = typeof report === "object" ? report : undefined;
  const failed = report === "failed" || (result && result.status !== "present");
  const message = result ? LABELS[result.status]
    : report === "checking" ? "Checking…"
    : report === "failed" ? "Could not run check"
    : "Ready to check";

  async function check() {
    setReport("checking");
    try {
      setReport(await window.contr.checkCodexHealth());
    } catch {
      setReport("failed");
    }
  }

  return (
    <section aria-label="Health check">
      <Group title="Health check" aside={
        <button type="button" onClick={() => void check()} disabled={report === "checking"} className={buttonClass()}>
          {report === undefined ? "Run check" : "Run again"}
        </button>
      }>
        <Row label="Codex orchestration">
          <span aria-live="polite" className={`min-w-0 text-right text-xs ${failed ? "text-error" : "text-muted"}`}>{message}</span>
        </Row>
        {result && (
          <Row label="Instructions">
            <PathValue label="Codex instructions file" path={result.file} />
          </Row>
        )}
        {result?.status === "missing" && (
          <Row>
            <button type="button" onClick={() => copy(CODEX_ORCHESTRATION_RULE)} className={`ml-auto ${buttonClass()}`}>
              {copied ? "Copied" : "Copy rule"}
            </button>
          </Row>
        )}
      </Group>
    </section>
  );
}
