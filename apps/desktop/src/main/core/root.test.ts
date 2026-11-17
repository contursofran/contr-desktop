import { describe, expect, it } from "vitest";
import { coreRoot, sharedWithHerdr, type InstallRecord } from "./root";

const home = "/h";
const none = () => false;
const only = (...dirs: string[]) => (d: string) => dirs.includes(d);

describe("coreRoot", () => {
  it("e2e with no CONTR_CORE_HOME has no root", () => {
    let asked = 0;
    const exists = () => {
      asked += 1;
      return true;
    };
    expect(coreRoot({ CONTR_HOME: "/c" }, home, exists, true, true)).toBeNull();
    expect(asked).toBe(0);
  });
  it("a dev run has no root", () => {
    expect(coreRoot({}, home, () => true, false, false)).toBeNull();
  });
  it("CONTR_CORE_HOME comes first, also in e2e", () => {
    expect(coreRoot({ CONTR_CORE_HOME: "/t/core", CONTR_HOME: "/c" }, home, none, true, false)).toEqual({ root: "/t/core", kind: "custom" });
  });
  it("contr-core, then contr-backend, then the Herdr folder, then contr-core", () => {
    const all = only("/h/.config/contr-core", "/h/.config/contr-backend", "/h/.config/herdr-app/herdr-contr");
    expect(coreRoot({}, home, all, false, true)).toEqual({ root: "/h/.config/contr-core", kind: "neutral" });
    const old = only("/h/.config/contr-backend", "/h/.config/herdr-app/herdr-contr");
    expect(coreRoot({}, home, old, false, true)).toEqual({ root: "/h/.config/contr-backend", kind: "old-neutral" });
    expect(coreRoot({}, home, only("/h/.config/herdr-app/herdr-contr"), false, true)).toEqual({ root: "/h/.config/herdr-app/herdr-contr", kind: "herdr" });
    expect(coreRoot({}, home, none, false, true)).toEqual({ root: "/h/.config/contr-core", kind: "neutral" });
  });
  it("CONTR_HOME and HERDR_APP_HOME come before the default", () => {
    const all = () => true;
    expect(coreRoot({ CONTR_HOME: "/c", HERDR_APP_HOME: "/a" }, home, all, false, true)).toEqual({ root: "/c", kind: "custom" });
    expect(coreRoot({ HERDR_APP_HOME: "/a" }, home, all, false, true)).toEqual({ root: "/a/herdr-contr", kind: "herdr" });
  });
});

describe("sharedWithHerdr", () => {
  const record = (r: InstallRecord | null) => () => r;
  const noLink = () => null;
  it("a root with a mod record or the Herdr link is shared", () => {
    expect(sharedWithHerdr("/r", record({ build: null, modFiles: 1 }), noLink, home)).toBe(true);
    const link = (p: string) => (p === "/r" || p === "/h/.config/herdr-app/herdr-contr" ? "/real" : null);
    expect(sharedWithHerdr("/r", record(null), link, home)).toBe(true);
    expect(sharedWithHerdr("/r", record({ build: "abc1234 2026-11-17", modFiles: 0 }), noLink, home)).toBe(false);
    // No Herdr folder: two nulls are not the same folder.
    expect(sharedWithHerdr("/r", record(null), () => null, home)).toBe(false);
  });
});
