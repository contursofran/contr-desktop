import type { Sidebar } from "../../shared/api";
import { findAgent } from "../topbar/TopBar";

/** The Chat / Terminal pick: one for the window (docs/design/recipe-herdr.md, Chat | Terminal switch). */
export type Side = "chat" | "terminal";

type Store = Pick<Storage, "getItem" | "setItem">;

const SHOWN_KEY = "tabs.shown";
const SIDE_KEY = "view.side";

/** The shown agent's terminal, kept in localStorage `tabs.shown` over restarts, as the open tabs are. "" when none. */
export function readShown(store: Store = localStorage): string {
  return store.getItem(SHOWN_KEY) ?? "";
}

export function saveShown(terminal: string, store: Store = localStorage): void {
  store.setItem(SHOWN_KEY, terminal);
}

/** The Chat / Terminal pick, kept in localStorage `view.side`. A missing or bad value gives "chat". */
export function readSide(store: Store = localStorage): Side {
  return store.getItem(SIDE_KEY) === "terminal" ? "terminal" : "chat";
}

export function saveSide(side: Side, store: Store = localStorage): void {
  store.setItem(SIDE_KEY, side);
}

/**
 * The agent to show at start: the stored one while the sidebar lists it; else the one main shows
 * (CONTR_TERMINAL); else the first agent of the list; else none ("").
 */
export function startAgent(sidebar: Sidebar, stored: string): string {
  if (stored && findAgent(sidebar, stored)) return stored;
  if (sidebar.selected) return sidebar.selected;
  return sidebar.projects.find((p) => p.agents.length > 0)?.agents[0]!.terminal ?? "";
}
