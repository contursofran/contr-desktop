import { describe, expect, it, vi } from "vitest";
vi.mock("electron", () => ({ net: {}, protocol: {} }));
import { imagePath } from "./localImages";

describe("imagePath", () => {
  it("allows PNG, JPEG and SVG files", () => {
    expect(imagePath("contr-image://local/tmp/a%20b.png")).toBe("/tmp/a b.png");
    expect(imagePath("contr-image://local/x/y.JPEG")).toBe("/x/y.JPEG");
    expect(imagePath("contr-image://local/x/y.svg")).toBe("/x/y.svg");
  });
  it("refuses other files, hosts and schemes", () => {
    expect(imagePath("contr-image://local/etc/passwd")).toBeNull();
    expect(imagePath("contr-image://local/x/secret.png.txt")).toBeNull();
    expect(imagePath("contr-image://other/x/y.png")).toBeNull();
    expect(imagePath("file:///x/y.png")).toBeNull();
    expect(imagePath("not a url")).toBeNull();
  });
});
