import { describe, expect, it } from "vitest";
import { addImage, readDraft, removeImage, saveDraft } from "./drafts";

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

describe("attachments in a draft", () => {
  it("adds a file after the others and keeps the text", () => {
    const draft = addImage({ text: "look", images: ["/a.png"] }, "/b.txt");
    expect(draft).toEqual({ text: "look", images: ["/a.png", "/b.txt"] });
  });

  it("removes only the attachment at the index, also when the same path is there twice", () => {
    const draft = { text: "look", images: ["/a.png", "/b.png", "/a.png"] };
    expect(removeImage(draft, 2)).toEqual({ text: "look", images: ["/a.png", "/b.png"] });
    expect(removeImage(draft, 0)).toEqual({ text: "look", images: ["/b.png", "/a.png"] });
    expect(draft.images).toEqual(["/a.png", "/b.png", "/a.png"]);
  });

  it("keeps the files of one terminal out of another, and drops a draft whose last file is removed", () => {
    saveDraft("t5", addImage(readDraft("t5"), "/a.png"));
    expect(readDraft("t6").images).toEqual([]);
    saveDraft("t5", removeImage(readDraft("t5"), 0));
    expect(readDraft("t5")).toEqual({ text: "", images: [] });
  });
});
