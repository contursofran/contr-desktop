import type { Card, PromptResult } from "../../shared/api";
import { runHelper, type HelperLine } from "./run";

/** Reads the helper's `card` answer. Null when no card is on screen or the helper gives an error. */
export function readCardAnswer(lines: HelperLine[]): Card | null {
  const line = lines.find((l) => l.type === "card");
  if (!line || typeof line.request !== "string") return null;
  if (line.kind === "approval") {
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    return { kind: "approval", request: line.request, title: str(line.title), command: str(line.command), tool: str(line.tool), answered: line.answered === true };
  }
  if (line.kind === "question" && line.question && typeof line.question === "object") {
    return { kind: "question", request: line.request, question: line.question as Extract<Card, { kind: "question" }>["question"], unread: Number(line.unread ?? 0) };
  }
  return null;
}

export async function readCard(helper: string, terminal: string): Promise<Card | null> {
  return readCardAnswer(await runHelper(helper, ["card", "--terminal", terminal]));
}

/** Reads a `done` answer of `approve` or `answer`. Only `sent` clears the card. */
export function readDone(lines: HelperLine[]): PromptResult {
  const error = lines.find((l) => l.type === "error");
  if (error) return { result: "failed", message: String(error.message) };
  const done = lines.find((l) => l.type === "done");
  const result = typeof done?.result === "string" ? done.result : "sent";
  return { result, message: typeof done?.message === "string" ? done.message : undefined };
}

/** Allows or denies an approval. The helper checks that `request` is still on screen before the key. */
export async function approve(helper: string, terminal: string, request: string, allow: boolean): Promise<PromptResult> {
  return readDone(await runHelper(helper, ["approve", "--terminal", terminal, "--request", request, allow ? "--allow" : "--deny"]));
}

/** Answers a question card: one {picks, other} per question, in order. */
export async function answer(helper: string, terminal: string, request: string, answers: Answer[]): Promise<PromptResult> {
  return readDone(await runHelper(helper, ["answer", "--terminal", terminal, "--request", request, "--answers", JSON.stringify(answers)]));
}

export interface Answer {
  picks: number[];
  other?: string;
}
