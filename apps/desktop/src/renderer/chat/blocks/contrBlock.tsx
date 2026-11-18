import type { ReactNode } from "react";
import { parseChart } from "./chart";
import { ChartBlock } from "./ChartBlock";
import { parseQueue, parseStatus } from "./parse";
import { QueueBlock } from "./QueueBlock";
import { StatusBlock } from "./StatusBlock";

/**
 * A `contr-status`, `contr-queue` or `contr-chart` fence drawn as its block; null for other languages and
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
  return null;
}
