import { describe, expect, it } from "vitest";
import { parseMachines, untilReset, usageRows } from "./usage";

const now = 1_000_000;

describe("usageRows", () => {
  it("shows the most used window of each plan, Claude then Codex", () => {
    const rows = usageRows(
      [{ type: "usage", plans: [
        { plan: "claude", read_at: now - 60, windows: [{ kind: "five_hour", used_percent: 38.4, resets_at: now + 7200 }, { kind: "seven_day", used_percent: 64.6, resets_at: now + 4 * 86_400 }] },
        { plan: "codex", windows: [{ kind: "five_hour", used_percent: 21, resets_at: now + 1800 }] },
      ] }],
      now,
    );
    expect(rows).toEqual([
      { plan: "Claude", percent: 65, value: "65% wk · 4d", readAt: (now - 60) * 1000 },
      { plan: "Codex", percent: 21, value: "21% 5h · 30m", readAt: null },
    ]);
  });

  it("names Codex's primary and secondary windows 5h and wk", () => {
    const codex = (used: [number, number]) => usageRows([{ type: "usage", plans: [{ plan: "codex", windows: [{ kind: "primary", used_percent: used[0], resets_at: now + 3600 * 3 }, { kind: "secondary", used_percent: used[1], resets_at: now + 5 * 86_400 }] }] }], now);
    expect(codex([30, 10])[0]!.value).toBe("30% 5h · 3h");
    expect(codex([10, 30])[0]!.value).toBe("30% wk · 5d");
  });

  it("picks the most used of the current windows; a window past its reset or without a number has no value", () => {
    const rows = usageRows([{ type: "usage", plans: [{ plan: "claude", windows: [{ kind: "five_hour", used_percent: 90, resets_at: now - 1 }, { kind: "seven_day", used_percent: 12, resets_at: null }, { kind: "five_hour", resets_at: now + 60 }] }] }], now);
    expect(rows).toEqual([{ plan: "Claude", percent: 12, value: "12% wk", readAt: null }]);
  });

  it("shows a plan with each window past its reset, or with no number, as stale: no percent and a dash", () => {
    const rows = usageRows([{ type: "usage", plans: [
      { plan: "claude", read_at: now - 2 * 86_400, windows: [{ kind: "seven_day", used_percent: 17, resets_at: now }, { kind: "five_hour", used_percent: 4, resets_at: now - 3600 }] },
      { plan: "codex", windows: [{ kind: "primary", used_percent: null, resets_at: now + 60 }] },
    ] }], now);
    expect(rows).toEqual([
      { plan: "Claude", percent: null, value: "—", readAt: (now - 2 * 86_400) * 1000 },
      { plan: "Codex", percent: null, value: "—", readAt: null },
    ]);
  });

  it("gives no row for a plan without windows, and none for an error", () => {
    expect(usageRows([{ type: "usage", plans: [{ plan: "codex", windows: [] }] }], now)).toEqual([]);
    expect(usageRows([{ type: "error", code: "helper", message: "x" }], now)).toEqual([]);
  });
});

describe("untilReset", () => {
  it("uses minutes, hours or days", () => {
    expect([untilReset(20), untilReset(3000), untilReset(5 * 3600), untilReset(3 * 86_400)]).toEqual(["1m", "50m", "5h", "3d"]);
  });
});

describe("parseMachines", () => {
  it("keeps named machines that are not temporary, and gives none for broken output", () => {
    expect(parseMachines(JSON.stringify({ machines: [{ name: "pc", state: "unreachable" }, { name: "t", temporary: true }, { state: "x" }] }))).toEqual([{ name: "pc", state: "unreachable" }]);
    expect(parseMachines("")).toEqual([]);
  });
});
