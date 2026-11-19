import { expect, it, vi } from "vitest";
import { terminalSearch } from "./search";

const addon = vi.hoisted(() => ({
  findNext: vi.fn(),
  findPrevious: vi.fn(),
  clearDecorations: vi.fn(),
  dispose: vi.fn(),
  onDidChangeResults: vi.fn(() => ({ dispose: vi.fn() })),
}));
vi.mock("@xterm/addon-search", () => ({ SearchAddon: class { constructor() { return addon; } } }));

const style = { getPropertyValue: () => "#123456" } as unknown as CSSStyleDeclaration;

it("loads search once, routes the direction and clears the active selection", async () => {
  const term = { loadAddon: vi.fn(), clearSelection: vi.fn() };
  const results = vi.fn();
  const search = terminalSearch(term, results);
  await search.find("", "incremental", style);
  expect(term.loadAddon).not.toHaveBeenCalled();
  await search.find("port", "incremental", style);
  await search.find("port", "previous", style);
  expect(term.loadAddon).toHaveBeenCalledExactlyOnceWith(addon);
  expect(addon.findNext).toHaveBeenCalledWith("port", expect.objectContaining({
    incremental: true, decorations: expect.objectContaining({ activeMatchBackground: "#123456" }),
  }));
  expect(addon.findPrevious).toHaveBeenCalledWith("port", expect.objectContaining({ incremental: false }));
  await search.find("", "incremental", style);
  expect(results).toHaveBeenLastCalledWith({ resultIndex: -1, resultCount: 0 });
  expect(term.clearSelection).toHaveBeenCalledOnce();
  search.dispose();
  expect(addon.dispose).toHaveBeenCalledOnce();
});

it("does not attach a pending search addon to a disposed terminal", async () => {
  const term = { loadAddon: vi.fn(), clearSelection: vi.fn() };
  const search = terminalSearch(term, vi.fn());
  const pending = search.find("port", "next", style);
  search.dispose();
  await pending;
  expect(term.loadAddon).not.toHaveBeenCalled();
});
