import { expect, it } from "vitest";
import { checkedText } from "./checked";

it("says just now under a minute, else the age", () => {
  expect(checkedText(1_000, 30_000)).toBe("Checked just now");
  expect(checkedText(0, 5 * 60_000)).toBe("Checked 5m ago");
  expect(checkedText(0, 3 * 3_600_000)).toBe("Checked 3h ago");
});
