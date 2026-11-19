import { expect, onTestFinished, vi } from "vitest";
import { page } from "vitest/browser";
import transcript from "../e2e/fixtures/claude-session.jsonl?raw";
import type { Card, ContrApi, FeedEvent, FeedRow, ReplyInfo, SidebarAgent } from "../src/shared/api";
import { saveDraft } from "../src/renderer/chat/reply/drafts";
import { contrFake } from "./contrFake";
import { renderApp } from "./renderApp";

const rows: FeedRow[] = transcript.trim().split("\n").map((line) => JSON.parse(line));
const working: FeedEvent = { type: "working", working: { text: "Hashing…", detail: "35s · ↓ 1.2k tokens" } };

export const replyState: ReplyInfo = {
  agent: "claude", model: "claude-opus-5-5", effort: "medium", tier: null, tiers: [], speed: null,
  context: { percent: 37, text: "37%", warn: false },
  models: [{ value: "claude-opus-5-5", label: "Opus 5.5" }, { value: "claude-sonnet-5", label: "Sonnet 5" }],
  efforts: ["low", "medium", "high"].map((value) => ({ value, label: value })),
};

export const sendError = "fake send error no_terminal";
export const replyBox = () => page.getByRole("textbox", { name: /^Reply to/ });
export const projectNav = () => page.getByRole("navigation", { name: "Projects" });
export const agentRow = (name: RegExp) => projectNav().getByRole("button", { name }).first();
export const replyForm = () => page.getByRole("form", { name: "Reply" });
export const statusLine = () => page.getByLabelText("Status");

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

type SendResult = Awaited<ReturnType<ContrApi["send"]>>;

export async function mountReply({
  card = null, holdFeed = false, initialRows = rows, workers = true, info = {},
  sends = [], overrides = {},
}: {
  card?: Card | null;
  holdFeed?: boolean;
  initialRows?: FeedRow[];
  workers?: boolean;
  info?: Partial<ReplyInfo>;
  sends?: (SendResult | Promise<SendResult>)[];
  overrides?: Partial<ContrApi>;
} = {}) {
  const initial: FeedEvent = { type: "splice", at: 0, rows: initialRows, agent: "claude", model: "claude-opus-5-5" };
  const defaults = contrFake(initialRows, card);
  const sidebar = await defaults.sidebar();
  const agents = sidebar.projects[0].agents;
  const root = agents[0];
  const workerRows: SidebarAgent[] = [
    ...root.workers,
    { terminal: "t10", title: "Virtual list", name: "b-50", kind: null, state: "done", issue: "50", workers: [] },
  ];
  const notes: SidebarAgent = { terminal: "t11", title: "Release notes draft", name: "notes", kind: "claude-code", state: "done", issue: null, workers: [] };
  const projects = [{
    ...sidebar.projects[0],
    agents: [{ ...root, workers: workers ? [...workerRows] : [] }, { ...notes, workers: [] }],
  }];

  let selected = sidebar.selected;
  const listeners = new Map<string, (event: FeedEvent) => void>();
  const emit = (event: FeedEvent) => {
    const receive = listeners.get(selected);
    if (!receive) throw new Error("Wait for the chat to subscribe before delivering a feed event");
    receive(event);
  };
  function firstFeed() {
    emit(initial);
    if (selected === root.terminal) emit(working);
    emit({ type: "card", card: selected === root.terminal ? card : null });
  }

  const calls: { terminal: string; text: string }[] = [];
  const send = vi.fn<ContrApi["send"]>(async (text) => {
    calls.push({ terminal: selected, text });
    return sends[calls.length - 1] ?? { ok: true };
  });

  onTestFinished(() => {
    for (const agent of projects[0].agents) saveDraft(agent.terminal, { text: "", images: [] });
  });

  await renderApp(transcript, card, {
    sidebar: async () => ({ selected, projects }),
    select: async (terminal) => { selected = terminal; return selected; },
    onFeed(listener) {
      const terminal = selected;
      listeners.set(terminal, listener);
      if (!holdFeed) firstFeed();
      return () => { listeners.delete(terminal); };
    },
    board: async () => ({
      workers: {}, roles: {}, agent: selected, checks: {},
      orchestrating: selected === root.terminal ? projects[0].agents[0].workers.length : 0,
    }),
    replyInfo: async () => ({ ...replyState, effort: selected === root.terminal ? "medium" : "high", ...info }),
    send,
    terminal: { ...defaults.terminal, attach: async () => ({ terminal: selected }), resize: () => {} },
    ...overrides,
  });
  return {
    calls,
    send,
    firstFeed,
    append: (row: FeedRow) => emit({ type: "splice", at: initialRows.length, rows: [row] }),
    sent: () => calls.map(({ text }) => text),
  };
}

export async function paste(type: "text/plain" | "image/png") {
  const el = await replyBox().findElement();
  const data = new DataTransfer();
  if (type === "text/plain") data.setData(type, "plain words");
  else data.items.add(new File(["x"], "x.png", { type }));
  return el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
}

/** A substring check on rendered text, as in Playwright's toContainText. */
export const containsText = (locator: ReturnType<typeof page.getByText>) =>
  expect.poll(() => locator.query()?.textContent?.replace(/\s+/g, " ").trim());
