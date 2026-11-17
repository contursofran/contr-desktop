import { describe, expect, it } from "vitest";
import { usageTip } from "./usageTip";

const now = 10 * 86_400_000;
const row = (percent: number | null, readAt: number | null) => ({ plan: "Claude", percent, value: percent === null ? "—" : `${percent}% wk`, readAt });

describe("usageTip", () => {
  it("says when a current row was read", () => {
    expect(usageTip(row(41, now - 2 * 3_600_000), now)).toBe("Read 2h ago");
    expect(usageTip(row(41, now - 10_000), now)).toBe("Read just now");
    expect(usageTip(row(41, null), now)).toBeNull();
  });

  it("says that a stale row has no current data, and when it was last read", () => {
    expect(usageTip(row(null, now - 2 * 86_400_000), now)).toBe("No current data. Last read 2d ago.");
    expect(usageTip(row(null, null), now)).toBe("No current data.");
  });
});
