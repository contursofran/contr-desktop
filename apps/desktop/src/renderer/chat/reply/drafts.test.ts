import { describe, expect, it } from "vitest";
import { readDraft, saveDraft } from "./drafts";

describe("drafts", () => {
  it("keeps one draft for each terminal", () => {
    saveDraft("t1", { text: "one", images: [] });
    saveDraft("t2", { text: "two", images: ["/a.png"] });
    expect(readDraft("t1")).toEqual({ text: "one", images: [] });
    expect(readDraft("t2")).toEqual({ text: "two", images: ["/a.png"] });
  });

  it("gives an empty draft for a terminal with none, and an empty draft clears it", () => {
    expect(readDraft("t9")).toEqual({ text: "", images: [] });
    saveDraft("t3", { text: "x", images: [] });
    saveDraft("t3", { text: "", images: [] });
    expect(readDraft("t3")).toEqual({ text: "", images: [] });
  });
});
