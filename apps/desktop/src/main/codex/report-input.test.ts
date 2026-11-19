import { expect, it, vi } from "vitest";
import { reportInput } from "./report-input";

it("keeps multiline input intact across reads and ignores unframed input", () => {
  const received = vi.fn();
  const input = reportInput(received);
  input("noise\r\x1b[2");
  input("00~worker: blocked\nSecond line\x1b[201~");
  expect(received).not.toHaveBeenCalled();
  input("\r\x1b[200~another report\x1b[201~\r");
  expect(received.mock.calls).toEqual([["worker: blocked\nSecond line"], ["another report"]]);
});
