import { describe, expect, it } from "vitest";
import { MAX_BARS, MAX_POINTS, outlierOf, parseBars, parseChart, parseLine } from "./chart";

describe("parseBars", () => {
  it("reads one bar per line, largest first, with k and M scaled", () => {
    expect(parseBars("r-31 | 61k | ctx 12%\n\nb-31|412k|ctx 72%\nb-60 | 1.2M | ended")).toEqual([
      { label: "b-60", text: "1.2M", value: 1_200_000, note: "ended" },
      { label: "b-31", text: "412k", value: 412_000, note: "ctx 72%" },
      { label: "r-31", text: "61k", value: 61_000, note: "ctx 12%" },
    ]);
  });
  it("keeps a unit that does not scale", () => {
    expect(parseBars("a | 72% | x\nb | 9% | y")?.map((b) => b.value)).toEqual([72, 9]);
  });
  it.each([
    ["an empty block", ""],
    ["no note", "b-31 | 412k"],
    ["an empty note", "b-31 | 412k | "],
    ["four fields", "b-31 | 412k | x | y"],
    ["no number", "b-31 | lots | x"],
    ["a negative value", "b-31 | -3 | x"],
    ["two units", "a | 4m | x\nb | 30% | y"],
  ])("refuses %s", (_, code) => expect(parseBars(code)).toBeNull());
  it("keeps the limit", () => {
    const rows = (n: number) => Array.from({ length: n }, (_, i) => `b-${i} | ${i} | x`).join("\n");
    expect(parseBars(rows(MAX_BARS))).toHaveLength(MAX_BARS);
    expect(parseBars(rows(MAX_BARS + 1))).toBeNull();
  });
});

describe("parseLine", () => {
  it("reads the points in the order written", () => {
    expect(parseLine("11:10 | 6.1\n14:52|6.5")).toEqual([
      { x: "11:10", text: "6.1", value: 6.1 },
      { x: "14:52", text: "6.5", value: 6.5 },
    ]);
  });
  it.each([
    ["one point", "11:10 | 6.1"],
    ["no y", "11:10 | 6.1\n11:20"],
    ["three fields", "11:10 | 6.1 | x\n11:20 | 2"],
    ["no number", "11:10 | 6.1\n11:20 | slow"],
    ["two units", "a | 4m\nb | 30%"],
  ])("refuses %s", (_, code) => expect(parseLine(code)).toBeNull());
  it("keeps the limit", () => {
    const pts = (n: number) => Array.from({ length: n }, (_, i) => `${i} | ${i}`).join("\n");
    expect(parseLine(pts(MAX_POINTS))).toHaveLength(MAX_POINTS);
    expect(parseLine(pts(MAX_POINTS + 1))).toBeNull();
  });
});

describe("parseChart", () => {
  it("takes the kind from the fence meta", () => {
    expect(parseChart("bar", "a | 1 | x")?.kind).toBe("bar");
    expect(parseChart("line", "a | 1\nb | 2")?.kind).toBe("line");
  });
  it.each([undefined, "", "pie", "bar line"])("refuses the meta %j", (meta) => {
    expect(parseChart(meta, "a | 1 | x")).toBeNull();
  });
});

describe("outlierOf", () => {
  it("labels the point farthest from the median", () => {
    expect(outlierOf([6.1, 5.8, 6.4, 6.0, 7.9, 6.2, 6.3, 5.9, 6.6, 9.4, 6.1, 6.5])).toBe(9);
    expect(outlierOf([5, 5, 1, 5, 5, 5])).toBe(2);
  });
  it("labels nothing in an even series, a short one, or when only the latest point is far", () => {
    expect(outlierOf([1, 2, 3, 4, 5, 6])).toBeNull();
    expect(outlierOf([1, 1, 9, 1])).toBeNull();
    expect(outlierOf([3, 3, 3, 3, 3, 9])).toBeNull();
  });
});
