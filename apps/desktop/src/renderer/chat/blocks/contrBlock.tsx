import type { ReactNode } from "react";
import { DigestBlock } from "./DigestBlock";
import { parseQueue, parseStatus } from "./parse";
import { parseDigest } from "./parse";
import { QueueBlock } from "./QueueBlock";
import { StatusBlock } from "./StatusBlock";

/** A `contr-status` or `contr-queue` fence drawn as its block; null for other languages and for a block that does not parse. */
export function contrBlock(language: string | undefined, code: string): ReactNode | null {
  if (language === "contr-status") {
    const lines = parseStatus(code);
    return lines && <StatusBlock lines={lines} />;
  }
  if (language === "contr-queue") {
    const steps = parseQueue(code);
    return steps && <QueueBlock steps={steps} />;
  }
  if (language === "contr-digest") return parseDigest(code) ? <DigestBlock /> : null;
  return null;
}
