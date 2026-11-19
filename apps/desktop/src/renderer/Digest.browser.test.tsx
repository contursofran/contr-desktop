import { afterEach, expect, test, vi } from "vitest";
import { page, type Locator } from "vitest/browser";
import fixture from "../../e2e/fixtures/digest-session.jsonl?raw";
import { chatRow, normalizedText } from "../../test/273-chatRows";
import { shoot } from "../../test/280-browser";
import { renderApp } from "../../test/renderApp";
import { parseOwnerOpen } from "../main/owner/owner";
import { DIGEST_POLL_MS } from "./chat/blocks/digestRead";
import type { Digest, FeedEvent, FeedRow } from "../shared/api";

const at = (day: number, hour: number, minute: number) => new Date(2026, 10, day, hour, minute).getTime();
const counts: Digest = { since: at(18, 22, 2), merged: 2, busy: 1, waiting: 2, failing: 1 };
const fence = "```contr-digest\n```";
const firstRows: FeedRow[] = [
  { id: "left", k: "user", ts: at(18, 22, 2), text: "I will read the update tomorrow." },
  { id: "asked", k: "user", ts: at(19, 13, 50), text: "What changed?" },
  { id: "earlier", k: "assistant", ts: at(19, 13, 55), text: fence },
];
const nextRows: FeedRow[] = [
  { id: "next-question", k: "user", ts: at(19, 14, 0), text: "Any further updates?" },
  { id: "latest", k: "assistant", ts: at(19, 14, 1), text: fence },
];

const cells = (digest: Locator) => Array.from(digest.element().querySelectorAll("[data-cell]"), normalizedText);
const emptyCells = ["—PRs merged", "—workers busy", "—wait for you", "—CI failures"];
const firstCells = ["2PRs merged", "1worker busy", "2wait for you", "1CI failure"];
const span = (digest: Locator) => digest.getByTestId("digest-span");
const region = async (id: string) => page.elementLocator(await chatRow(id)).getByRole("region", { name: "Since you left" });
const jsonLines = (rows: FeedRow[]) => rows.map((row) => JSON.stringify(row)).join("\n");

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const owner = parseOwnerOpen(JSON.stringify([
  { id: "D7", coordinator: "hc:t7", title: "Block or row?", from: "b-40", question: "Block or row?", options: ["Block", "Row"] },
  { id: "T3", kind: "todo", coordinator: "t7", from: "lead", text: "Run the staging e2e" },
  { id: "D9", coordinator: "t12", title: "Other", from: "b-30", question: "Not this chat", options: ["Yes"] },
]));

test("the digest shows the counts and time span; a block with text stays code", async () => {
  vi.spyOn(Date, "now").mockReturnValue(at(19, 13, 55));
  await renderApp(fixture, null, { digest: async () => counts, owner: async () => owner });
  const row = await chatRow("r1");
  const digest = page.elementLocator(row).getByRole("region", { name: "Since you left" });
  await expect.poll(() => cells(digest)).toEqual(firstCells);
  expect(digest.elements()).toHaveLength(1);
  await expect.element(span(digest)).toHaveTextContent("Wed 18 Nov 22:02 → Thu 19 Nov 13:55");
  const color = (cell: string) => getComputedStyle(digest.element().querySelector(`[data-cell=${cell}] span`)!).color;
  expect(color("waiting")).toBe("rgb(240, 113, 120)");
  expect(color("merged")).toBe("rgb(244, 244, 245)");
  const code = row.querySelectorAll("pre");
  expect(code).toHaveLength(1);
  expect(normalizedText(code[0])).toContain("last 3h");
});


test("an older digest without a snapshot shows the answer span and unavailable counts", async () => {
  vi.spyOn(Date, "now").mockReturnValue(at(19, 14, 2));
  const digest = vi.fn(async () => ({ ...counts, since: at(19, 13, 50) }));
  const last = { ...nextRows[1]!, text: `${fence}\n\n> ${fence.replace("\n", "\n> ")}` };
  await renderApp(jsonLines([...firstRows, nextRows[0]!, last]), null, { digest });
  const older = await region("earlier");
  await expect.element(span(older)).toHaveTextContent("Wed 18 Nov 22:02 → Thu 19 Nov 13:55");
  expect(cells(older)).toEqual(emptyCells);
  const latest = await region("latest");
  expect(latest.elements()).toHaveLength(2);
  expect(cells(latest.nth(0))).toEqual(emptyCells);
  await expect.poll(() => cells(latest.nth(1))).toEqual(firstCells);
  await expect.element(span(latest.nth(1))).toHaveTextContent("13:50 → 14:02");
  expect(digest).toHaveBeenCalledTimes(1);
});

test("the last digest polls and earlier digests keep their last read across a view switch", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const now = vi.spyOn(Date, "now").mockReturnValue(at(19, 13, 55));
  const later = { since: at(19, 13, 50), merged: 3, busy: 2, waiting: 0, failing: 0 };
  const digest = vi.fn().mockResolvedValueOnce(counts).mockResolvedValue({ ...later, merged: 1 });
  let send: (event: FeedEvent) => void = () => {};
  const unknown = { ...firstRows[2]!, id: "unknown", ts: at(19, 13, 54) };
  const initial = [...firstRows.slice(0, 2), unknown, firstRows[2]!];
  let rows = initial;
  await renderApp(jsonLines(initial), null, {
    digest,
    onFeed(listener) {
      send = listener;
      listener({ type: "splice", at: 0, rows });
      return () => {};
    },
  });
  await expect.poll(async () => cells(await region("earlier"))).toEqual(firstCells);
  expect(digest).toHaveBeenCalledTimes(1);
  now.mockReturnValue(at(19, 14, 2));
  rows = [...initial, ...nextRows];
  send({ type: "splice", at: initial.length, rows: nextRows });
  await expect.poll(async () => cells(await region("latest"))).toEqual(["1PR merged", "2workers busy", "0wait for you", "0CI failures"]);
  digest.mockResolvedValue(later);
  now.mockReturnValue(at(19, 14, 3));
  await vi.advanceTimersByTimeAsync(DIGEST_POLL_MS);
  const laterCells = ["3PRs merged", "2workers busy", "0wait for you", "0CI failures"];
  await expect.poll(async () => cells(await region("latest"))).toEqual(laterCells);
  expect(digest).toHaveBeenCalledTimes(3);
  const navigation = page.getByRole("navigation", { name: "Projects" });
  await navigation.getByRole("button", { name: /^Inbox/ }).click();
  await navigation.getByRole("button", { name: /Chat panel usability audit/ }).click();
  await expect.poll(async () => cells(await region("latest"))).toEqual(laterCells);
  const older = await region("earlier");
  expect(cells(older)).toEqual(firstCells);
  await expect.element(span(older)).toHaveTextContent("Wed 18 Nov 22:02 → Thu 19 Nov 13:55");
  const archived = await region("unknown");
  expect(cells(archived)).toEqual(emptyCells);
  await expect.element(span(archived)).toHaveTextContent("Wed 18 Nov 22:02 → Thu 19 Nov 13:54");
  await shoot("219-digest");
});
