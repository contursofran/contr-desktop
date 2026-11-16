import { describe, expect, it } from "vitest";
import { binPath } from "./binPath";

describe("binPath", () => {
  it("takes the override first", () => {
    expect(binPath("x", "/R/app.asar", "/o/x")).toBe("/o/x");
  });
  it("uses Resources/bin in the packaged app", () => {
    expect(binPath("herdr-contr-orch", "/A.app/Contents/Resources/app.asar")).toBe(
      "/A.app/Contents/Resources/bin/herdr-contr-orch",
    );
  });
  it("uses bin/ at the repository root in dev", () => {
    expect(binPath("herdr-contr-feed", "/r/apps/desktop")).toBe("/r/bin/herdr-contr-feed");
  });
});
