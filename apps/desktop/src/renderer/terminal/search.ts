// Adapted from microsoft/vscode src/vs/workbench/contrib/terminal/browser/xterm/xtermTerminal.ts
// at e82e774f0735d47ee7021d34a6055234229cc9b3. Use a lazy addon and contr's theme tokens.
import type { ISearchOptions, ISearchResultChangeEvent, SearchAddon } from "@xterm/addon-search";
import type { Terminal } from "@xterm/xterm";

export function terminalSearch(term: Pick<Terminal, "loadAddon" | "clearSelection">, onResults: (results: ISearchResultChangeEvent) => void) {
  let addon: SearchAddon | undefined;
  let addonPromise: Promise<SearchAddon | undefined> | undefined;
  let disposed = false;
  let request = 0;
  let searched = false;
  let activeColor = "";
  let subscription: ReturnType<SearchAddon["onDidChangeResults"]> | undefined;

  function getSearchAddon() {
    if (!addonPromise) {
      addonPromise = import("@xterm/addon-search").then(({ SearchAddon }) => {
        if (disposed) return;
        addon = new SearchAddon();
        term.loadAddon(addon);
        subscription = addon.onDidChangeResults(onResults);
        return addon;
      }).catch(() => {
        addonPromise = undefined;
        return undefined;
      });
    }
    return addonPromise;
  }

  function clear() {
    request++;
    addon?.clearDecorations();
    if (searched) term.clearSelection();
    searched = false;
  }

  return {
    async find(query: string, direction: "incremental" | "next" | "previous", style: CSSStyleDeclaration) {
      if (disposed) return;
      if (!query) {
        clear();
        onResults({ resultIndex: -1, resultCount: 0 });
        return;
      }
      const current = ++request;
      const search = await getSearchAddon();
      if (!search || current !== request) return;
      const token = (name: string) => style.getPropertyValue(name).trim();
      const active = token("--glow-slate");
      const match = token("--glow-graphite");
      if (active !== activeColor) {
        search.clearDecorations();
        activeColor = active;
      }
      const searchOptions: ISearchOptions = {
        incremental: direction === "incremental",
        decorations: {
          activeMatchBackground: active,
          activeMatchBorder: token("--ink-95"),
          activeMatchColorOverviewRuler: active,
          matchBackground: match,
          matchOverviewRuler: match,
        },
      };
      searched = true;
      if (direction === "previous") search.findPrevious(query, searchOptions);
      else search.findNext(query, searchOptions);
    },
    dispose() {
      disposed = true;
      clear();
      subscription?.dispose();
      addon?.dispose();
    },
  };
}
