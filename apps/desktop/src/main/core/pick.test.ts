import { describe, expect, it } from "vitest";
import { pickCore, type PickInput } from "./pick";

const base: PickInput = { root: "/r", shared: false, allowed: false, homeHelper: true, order: "same" };

describe("pickCore", () => {
  it("no root runs the bundle", () => {
    expect(pickCore({ ...base, root: null })).toEqual({ source: "bundle", action: "none", shared: false });
  });
  it("a shared root with no yes runs the bundle and installs nothing", () => {
    expect(pickCore({ ...base, shared: true, homeHelper: false, order: "older" })).toEqual({ source: "bundle", action: "none", shared: true });
  });
  it("a shared root with the yes is a home", () => {
    expect(pickCore({ ...base, shared: true, allowed: true })).toEqual({ source: "home", action: "none", shared: true });
  });
  it("no home helper or an older home needs the install", () => {
    expect(pickCore({ ...base, homeHelper: false })).toEqual({ source: "home", action: "install", shared: false });
    expect(pickCore({ ...base, order: "older" })).toEqual({ source: "home", action: "install", shared: false });
  });
  it("a newer or unknown home runs the home with no install", () => {
    for (const order of ["same", "newer", "unknown"] as const) expect(pickCore({ ...base, order })).toEqual({ source: "home", action: "none", shared: false });
  });
});
