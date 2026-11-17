import { describe, expect, it, vi } from "vitest";
import { guardLinks, linkToOpen } from "./links";

const page = "file:///app/out/renderer/index.html";

describe("linkToOpen", () => {
  it("opens http, https and mailto", () => {
    expect(linkToOpen("https://example.com/a?b=1#c", page)).toBe("https://example.com/a?b=1#c");
    expect(linkToOpen("http://example.com", page)).toBe("http://example.com/");
    expect(linkToOpen("mailto:owner@example.com", page)).toBe("mailto:owner@example.com");
    expect(linkToOpen("HTTPS://Example.com/x", page)).toBe("https://example.com/x");
  });

  it("opens nothing for each other scheme", () => {
    for (const url of ["file:///etc/hosts", "javascript:alert(1)", "vscode://file/a.ts", "data:text/html,x", "contr-image://local/a.png", "ftp://example.com"]) {
      expect(linkToOpen(url, page)).toBeNull();
    }
  });

  it("opens nothing for a URL that does not parse", () => {
    expect(linkToOpen("", page)).toBeNull();
    expect(linkToOpen("notes/plan.md", page)).toBeNull();
  });

  it("opens nothing for a link to the app's own server (a relative path in dev)", () => {
    expect(linkToOpen("http://localhost:5173/notes/plan.md", "http://localhost:5173/")).toBeNull();
    expect(linkToOpen("http://localhost:3000/x", "http://localhost:5173/")).toBe("http://localhost:3000/x");
  });
});

/** A fake WebContents that keeps its window-open handler and its listeners. */
function fakeContents(url = page) {
  let openHandler: (details: { url: string }) => { action: string } = () => ({ action: "allow" });
  const listeners = new Map<string, (event: { url: string; preventDefault(): void }) => void>();
  const contents = {
    getURL: () => url,
    setWindowOpenHandler: (h: typeof openHandler) => { openHandler = h; },
    on: (name: string, l: (event: { url: string; preventDefault(): void }) => void) => { listeners.set(name, l); return contents; },
  };
  const navigate = (name: string, to: string) => {
    const preventDefault = vi.fn();
    listeners.get(name)!({ url: to, preventDefault });
    return preventDefault.mock.calls.length > 0;
  };
  return { contents, windowOpen: (to: string) => openHandler({ url: to }), navigate };
}

describe("guardLinks", () => {
  it("denies each new window and opens only an allowed URL", () => {
    const open = vi.fn();
    const f = fakeContents();
    guardLinks(f.contents as never, open);
    expect(f.windowOpen("https://example.com/")).toEqual({ action: "deny" });
    expect(f.windowOpen("file:///tmp/plan.md")).toEqual({ action: "deny" });
    expect(f.windowOpen("javascript:alert(1)")).toEqual({ action: "deny" });
    expect(open.mock.calls).toEqual([["https://example.com/"]]);
  });

  it.each(["will-navigate", "will-redirect"])("%s away from the page is stopped, with the same rule", (name) => {
    const open = vi.fn();
    const f = fakeContents();
    guardLinks(f.contents as never, open);
    expect(f.navigate(name, "https://example.com/")).toBe(true);
    expect(f.navigate(name, "file:///tmp/plan.md")).toBe(true);
    expect(f.navigate(name, "vscode://file/a.ts")).toBe(true);
    expect(open.mock.calls).toEqual([["https://example.com/"]]);
  });

  it("lets the app's own page reload or change its hash, and the first load go", () => {
    const open = vi.fn();
    const f = fakeContents();
    guardLinks(f.contents as never, open);
    expect(f.navigate("will-navigate", page)).toBe(false);
    expect(f.navigate("will-navigate", `${page}#top`)).toBe(false);
    const first = fakeContents("");
    guardLinks(first.contents as never, open);
    expect(first.navigate("will-redirect", "http://localhost:5173/")).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });
});
