import { commands, page, type Locator } from "vitest/browser";
import transcript from "../e2e/fixtures/claude-session.jsonl?raw";
import type { ContrApi, FeedRow, ReplyInfo, Sidebar } from "../src/shared/api";
import { findAgent } from "../src/renderer/topbar/TopBar";

export { transcript };
export const helperPath = "/work/contr-desktop/apps/desktop/e2e/fixtures/long/path/to/test/binaries/fake-helper.mjs";
export const helperError = { type: "error", code: "no-core", message: "fake error no-core" } as const;

export function replyInfo(context = 37, model = "claude-opus-5-5", effort = "medium"): ReplyInfo {
  return {
    agent: "claude", model, effort, tier: null, tiers: [], speed: null,
    context: { percent: context, text: `${context}%`, warn: false },
    models: [{ value: "claude-opus-5-5", label: "Opus 5.5" }, { value: "claude-sonnet-5", label: "Sonnet 5" }],
    efforts: ["low", "medium", "high"].map((value) => ({ value, label: value })),
  };
}

export function selectable(data: Sidebar) {
  let selected = data.selected;
  const overrides = {
    sidebar: async () => ({ ...data, selected }),
    select: async (terminal) => (selected = terminal),
    tabTitle: async (terminal) => ({ title: findAgent(data, terminal)?.title ?? "Terminal" }),
    board: async () => ({
      workers: {}, roles: {}, agent: selected, checks: {},
      orchestrating: findAgent(data, selected)?.workers.length ?? 0,
    }),
  } satisfies Partial<ContrApi>;
  return { overrides, selected: () => selected };
}

export const rows = (fixture: string): FeedRow[] =>
  fixture.trim().split("\n").map((line) => JSON.parse(line));

export const rect = (target: Locator) => target.element().getBoundingClientRect();

export function color(variable: string) {
  const probe = document.createElement("span");
  probe.style.color = `var(${variable})`;
  document.body.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}

export async function shot(name: string, target: Pick<Locator, "screenshot"> = page) {
  await target.screenshot({ path: `../../../../tmp/shots/browser/${name}.png` });
}

export async function shoot(name: string, target?: Locator) {
  for (const scheme of ["dark", "light"] as const) {
    await commands.colorScheme(scheme);
    await shot(`${name}-${scheme}`, target);
  }
}

/** Read CSS hooks from the mounted DOM. Use role locators for actions. */
export const css = (selector: string, scope?: Locator) =>
  (scope ? scope.element() : document).querySelector<HTMLElement>(selector)!;

export const count = (selector: string, scope: Locator) =>
  scope.query()?.querySelectorAll(selector).length ?? 0;
