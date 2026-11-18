import type { ReactNode } from "react";
import { parseChart } from "./chart";
import { ChartBlock } from "./ChartBlock";
import { DigestBlock } from "./DigestBlock";
import { parseDigest, parseQueue, parseStatus } from "./parse";
import { QueueBlock } from "./QueueBlock";
import { parsePr } from "./parse";
import { PrCardBlock } from "./PrCardBlock";
import { StatusBlock } from "./StatusBlock";

/**
 * A `contr-status`, `contr-queue`, `contr-chart`, `contr-digest` or `contr-pr` fence drawn as its block; null for other languages and
 * for a block that does not parse. `meta` is the rest of the fence line (`bar` or `line` for a chart).
 */
export function contrBlock(language: string | undefined, code: string, meta?: string): ReactNode | null {
  if (language === "contr-status") {
    const lines = parseStatus(code);
    return lines && <StatusBlock lines={lines} />;
  }
  if (language === "contr-queue") {
    const steps = parseQueue(code);
    return steps && <QueueBlock steps={steps} />;
  }
  if (language === "contr-chart") {
    const chart = parseChart(meta, code);
    return chart && <ChartBlock chart={chart} />;
  }
  if (language === "contr-digest") return parseDigest(code) ? <DigestBlock /> : null;
  if (language === "contr-pr") {
    const n = parsePr(code);
    return n ? <PrCardBlock number={n} /> : null;
  }
  return null;
}
