// Adapted from generalaction/emdash apps/emdash-desktop/src/renderer/tests/browser/terminal-shell-menu.test.tsx
// (9e2942b8281b17703c0e66845080a556ae262677). Mount contr with a preload double and clear renderer state at teardown.
// Mount the real renderer and its CSS as in pingdotgg/t3code apps/web/src/components/ChatMarkdown.browser.test.tsx
// (5b265f8eb7db05df055b2e882d4c10d332076d6b). Use contr's existing fixture rows and cards.
import { createRoot } from "react-dom/client";
import { onTestFinished, vi } from "vitest";
import { page } from "vitest/browser";
import { App } from "../src/renderer/App";
import "../src/renderer/index.css";
import type { Card, ContrApi, FeedRow } from "../src/shared/api";
import { contrFake } from "./contrFake";

export async function renderApp(fixture: string, card: Card | null = null, overrides?: Partial<ContrApi>) {
  const rows: FeedRow[] = fixture.trim().split("\n").map((line) => JSON.parse(line));
  await page.viewport(1200, 800);
  vi.stubGlobal("contr", contrFake(rows, card, overrides));
  const host = document.createElement("div");
  host.id = "root";
  document.body.append(host);
  const root = createRoot(host);
  onTestFinished(() => {
    root.unmount();
    host.remove();
    localStorage.clear();
    vi.unstubAllGlobals();
  });
  root.render(<App />);
}
