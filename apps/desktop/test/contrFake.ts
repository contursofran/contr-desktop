import type { Card, ContrApi, FeedRow, Sidebar, UpdateState } from "../src/shared/api";

const terminal = "t7";
const title = "Chat panel usability audit";
const sidebar: Sidebar = {
  selected: terminal,
  projects: [{
    name: "contr-desktop", cwd: "/work/contr-desktop", branch: "main", ahead: 0, behind: 0, favicon: null,
    agents: [{
      terminal, title, name: "orch-contr-desktop", kind: "claude-code", state: "working", issue: null,
      workers: [
        { terminal: "t8", title: "Install health check", name: "b-30", kind: "claude-code", state: "working", issue: "30", workers: [] },
        { terminal: "t9", title: "Cards", name: "b-40", kind: "claude-code", state: "blocked", issue: "40", workers: [] },
      ],
    }],
  }],
};
const update: UpdateState = {
  current: "0.0.0", dev: true, latest: null, available: false, progress: null,
  downloaded: null, ready: false, error: null, checking: false, checked: null,
};
const unsubscribe = () => () => {};
const unsupported = () => { throw new Error("Set a browser test override for this contr API call"); };

/** The renderer's side of the preload contract. Override actions with spies when a test uses them. */
export function contrFake(rows: FeedRow[], card: Card | null, overrides: Partial<ContrApi> = {}): ContrApi {
  return {
    platform: "darwin",
    onFeed(listener) {
      listener({ type: "splice", at: 0, rows, agent: "claude", model: "claude-opus-5-5" });
      if (card) listener({ type: "card", card });
      return () => {};
    },
    sidebar: async () => sidebar,
    onSidebar: unsubscribe,
    select: async (selected) => selected,
    tabTitle: async () => ({ title }),
    send: unsupported,
    pasteImage: unsupported,
    pickImage: unsupported,
    refs: async () => ({}),
    openRef: unsupported,
    approve: unsupported,
    answer: unsupported,
    board: async () => ({ workers: {}, roles: {}, agent: terminal, checks: {}, orchestrating: 2 }),
    digest: unsupported,
    replyInfo: async () => ({
      agent: "claude", model: "claude-opus-5-5", effort: "high", tier: null, tiers: [], speed: null,
      context: { percent: 37, text: "37%", warn: false }, models: [], efforts: [],
    }),
    setTier: unsupported,
    branch: async () => "main",
    usage: async () => [],
    onUsage: unsubscribe,
    machines: async () => [],
    owner: async () => ({ questions: [], todos: [] }),
    onOwner: unsubscribe,
    ownerError: async () => null,
    onOwnerError: unsubscribe,
    ownerAnswer: unsupported,
    ownerDone: unsupported,
    settings: async () => ({ theme: "system", helper: "/work/bin/herdr-contr-feed" }),
    health: async () => null,
    checkHealth: async () => ({ checked: Date.now(), machines: [] }),
    onHealth: unsubscribe,
    setTheme: unsupported,
    update: async () => update,
    onUpdate: unsubscribe,
    downloadUpdate: unsupported,
    restartToUpdate: unsupported,
    checkUpdate: unsupported,
    changeLog: async () => ({ releases: null, error: null }),
    core: async () => ({ ...update, root: null, source: "bundle", shared: false, installing: false, updated: null }),
    onCore: unsubscribe,
    checkCore: unsupported,
    onOpenSettings: unsubscribe,
    terminal: { attach: unsupported, input: unsupported, resize: unsupported, onData: unsubscribe, onEnd: unsubscribe },
    prCard: async () => null,
    ...overrides,
  };
}
