import { describe, expect, it, vi } from "vitest";
import { pickImage } from "./pick";

describe("pickImage", () => {
  it("returns the picked file and asks for images only", async () => {
    const show = vi.fn().mockResolvedValue({ canceled: false, filePaths: ["/a/b.png"] });
    expect(await pickImage({}, show)).toEqual({ ok: true, path: "/a/b.png" });
    expect(show.mock.calls[0][0].filters).toEqual([{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }]);
  });
  it("returns null when the picker is canceled", async () => {
    const show = vi.fn().mockResolvedValue({ canceled: true, filePaths: [] });
    expect(await pickImage({}, show)).toEqual({ ok: true, path: null });
  });
  it("returns an error when the picker fails", async () => {
    const show = vi.fn().mockRejectedValue(new Error("boom"));
    expect(await pickImage({}, show)).toEqual({ ok: false, path: null, message: "Error: boom" });
  });
  it("uses CONTR_E2E_PICK_IMAGE only with CONTR_E2E=1", async () => {
    const show = vi.fn().mockResolvedValue({ canceled: true, filePaths: [] });
    expect(await pickImage({ CONTR_E2E: "1", CONTR_E2E_PICK_IMAGE: "/f/x.png" }, show)).toEqual({ ok: true, path: "/f/x.png" });
    expect(show).not.toHaveBeenCalled();
    expect(await pickImage({ CONTR_E2E_PICK_IMAGE: "/f/x.png" }, show)).toEqual({ ok: true, path: null });
    expect(show).toHaveBeenCalledOnce();
  });
});
