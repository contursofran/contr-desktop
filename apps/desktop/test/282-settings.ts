import { vi } from "vitest";
import { page } from "vitest/browser";
import transcript from "../e2e/fixtures/claude-session.jsonl?raw";
import type { ContrApi, CoreState, UpdateState } from "../src/shared/api";
import { renderApp } from "./renderApp";

const appState: UpdateState = {
  current: "0.0.0", dev: false, latest: null, available: false, progress: null,
  downloaded: null, ready: false, error: null, checking: false, checked: null,
};
export const coreState: CoreState = {
  ...appState, current: "bbbbbbb 2026-11-17", root: "/fake/core", source: "home",
  shared: false, installing: false, updated: null,
};

function publisher<T>(state: T) {
  const listeners = new Set<(state: T) => void>();
  return {
    read: async () => state,
    subscribe(listener: (state: T) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    publish(next: Partial<T>) {
      state = { ...state, ...next };
      for (const listener of listeners) listener(state);
    },
  };
}

export const footer = () => page.getByRole("button", { name: /^Settings(?: Update ready)?$/ });
export const settings = () => page.getByRole("region", { name: "Settings" });

/** Give Settings and the sidebar the same state, with the option to publish a later check result. */
export async function mountSettings({
  app = {},
  core = { dev: true, current: "", root: null, source: "bundle" },
  overrides,
}: {
  app?: Partial<UpdateState>;
  core?: Partial<CoreState>;
  overrides?: Partial<ContrApi>;
} = {}) {
  const update = publisher({ ...appState, ...app });
  const coreUpdate = publisher({ ...coreState, ...core });
  const checkUpdate = vi.fn<ContrApi["checkUpdate"]>(async () => {});
  const checkCore = vi.fn<ContrApi["checkCore"]>(async () => {});
  const downloadUpdate = vi.fn<ContrApi["downloadUpdate"]>(async () => {});
  await renderApp(transcript, null, {
    update: update.read, onUpdate: update.subscribe, checkUpdate, downloadUpdate,
    core: coreUpdate.read, onCore: coreUpdate.subscribe, checkCore,
    ...overrides,
  });
  await footer().click();
  return { update, coreUpdate, checkUpdate, checkCore, downloadUpdate };
}
