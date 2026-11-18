import { expect, it, vi } from "vitest";
import type { UsageRow } from "../../shared/api";
import { subscribeUsage, type UsageSnapshot } from "../state/usage";
import { usageTip } from "./usageTip";

it("uses the delivery time for the initial usage and later updates", async () => {
  const mountedAt = Date.UTC(2026, 0, 10);
  const row: UsageRow = { plan: "Claude", percent: null, value: "—", readAt: mountedAt - 2 * 86_400_000 + 1_000 };
  let publish: ((rows: UsageRow[]) => void) | undefined;
  const unsubscribe = vi.fn();
  const onChange = vi.fn<(snapshot: UsageSnapshot) => void>();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(mountedAt);

  try {
    const stop = subscribeUsage({
      usage: () => Promise.resolve([row]),
      onUsage: (listener) => {
        publish = listener;
        return unsubscribe;
      },
    }, onChange);

    // The read crosses the two-day boundary between mount and delivery.
    vi.setSystemTime(mountedAt + 2_000);
    await Promise.resolve();
    const [initial] = onChange.mock.lastCall!;
    expect(usageTip(initial.rows[0]!, initial.now)).toBe("No current data. Last read 2d ago.");

    vi.setSystemTime(mountedAt + 4_000);
    publish!([{ ...row, readAt: row.readAt! + 2_000 }]);
    const [update] = onChange.mock.lastCall!;
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(usageTip(update.rows[0]!, update.now)).toBe("No current data. Last read 2d ago.");

    stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});
