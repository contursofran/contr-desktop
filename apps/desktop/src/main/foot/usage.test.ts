import { describe, expect, it } from "vitest";
import { parseMachines, untilReset, usageRows } from "./usage";

const now = 1_000_000;

describe("usageRows", () => {
  it("shows the most used window of each plan, Claude then Codex", () => {
    const rows = usageRows(
      [{ type: "usage", plans: [
        { plan: "claude", windows: [{ kind: "five_hour", used_percent: 38.4, resets_at: now + 7200 }, { kind: "seven_day", used_percent: 64.6, resets_at: now + 4 * 86_400 }] },
        { plan: "codex", windows: [{ kind: "five_hour", used_percent: 21, resets_at: now + 1800 }] },
      ] }],
      now,
    );
    expect(rows).toEqual([
      { plan: "Claude", percent: 65, value: "65% wk · 4d" },
      { plan: "Codex", percent: 21, value: "21% 5h · 30m" },
    ]);
  });

  it("shows a window past its reset as 0%, and no time when the reset is not known", () => {
    const rows = usageRows([{ type: "usage", plans: [{ plan: "claude", windows: [{ kind: "five_hour", used_percent: 90, resets_at: now - 1 }, { kind: "seven_day", used_percent: 12, resets_at: null }] }] }], now);
    expect(rows).toEqual([{ plan: "Claude", percent: 12, value: "12% wk" }]);
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
