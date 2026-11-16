import { describe, expect, it } from "vitest";
import { composeMessage, isSendKey } from "./message";

describe("composeMessage", () => {
  it("puts each image path after the text", () => {
    expect(composeMessage(" fix it \n", ["/p/a.png", "/p/b.png"])).toBe("fix it\n/p/a.png\n/p/b.png");
  });
  it("sends only the images when there is no text", () => {
    expect(composeMessage("  ", ["/p/a.png"])).toBe("/p/a.png");
  });
  it("is empty when there is nothing", () => {
    expect(composeMessage(" ", [])).toBe("");
  });
});

describe("isSendKey", () => {
  it("sends on Enter", () => expect(isSendKey({ key: "Enter", shiftKey: false })).toBe(true));
  it("does not send on Shift+Enter", () => expect(isSendKey({ key: "Enter", shiftKey: true })).toBe(false));
  it("does not send while composing", () =>
    expect(isSendKey({ key: "Enter", shiftKey: false, isComposing: true })).toBe(false));
  it("does not send on other keys", () => expect(isSendKey({ key: "a", shiftKey: false })).toBe(false));
});
