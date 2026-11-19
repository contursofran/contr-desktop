import { expect, it, vi } from "vitest";
import { makeTermLinkHandler } from "./links";

it.each([[true, true, false], [false, false, true], [true, false, true], [false, true, false], [false, false, false]])(
  "macOS %s, Meta %s and Ctrl %s",
  (isMac, metaKey, ctrlKey) => {
    const open = vi.fn();
    const event = { metaKey, ctrlKey, preventDefault: vi.fn() };
    const uri = "https://example.com/";
    makeTermLinkHandler(isMac, open)(event as unknown as MouseEvent, uri);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    if (isMac ? metaKey : ctrlKey) expect(open).toHaveBeenCalledExactlyOnceWith(uri);
    else expect(open).not.toHaveBeenCalled();
  },
);
