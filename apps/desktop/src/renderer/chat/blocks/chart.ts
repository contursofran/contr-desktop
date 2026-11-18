/** One bar of a `contr-chart bar` block: `<label> | <value> | <note>`. */
export interface Bar {
  label: string;
  /** The value as the agent wrote it, such as `412k`. */
  text: string;
  value: number;
  note: string;
}

/** One point of a `contr-chart line` block: `<x> | <y>`. */
export interface Point {
  x: string;
  text: string;
  value: number;
}

export type Chart = { kind: "bar"; bars: Bar[] } | { kind: "line"; points: Point[] };

/** The limits: a chart with more bars or points shows as code. */
export const MAX_BARS = 12;
export const MAX_POINTS = 60;

const SCALE: Record<string, number> = { k: 1e3, M: 1e6 };

/** A number with an optional unit, such as `412k`, `6.1`, `72%` or `14m`; `k` and `M` scale the number. */
function readValue(text: string): { value: number; unit: string } | null {
  const m = /^(-?\d+(?:\.\d+)?)\s*([A-Za-z%]{0,4})$/.exec(text);
  if (!m) return null;
  const unit = m[2]!;
  const scale = SCALE[unit];
  return scale ? { value: Number(m[1]) * scale, unit: "" } : { value: Number(m[1]), unit };
}

function fields(code: string): string[][] {
  return code.split("\n").map((l) => l.trim()).filter((l) => l !== "").map((l) => l.split("|").map((p) => p.trim()));
}

/** The bars, largest first, or null when one line does not parse, a value is negative, or the units differ. */
export function parseBars(code: string): Bar[] | null {
  const bars: Bar[] = [];
  let unit: string | null = null;
  for (const [label, text, note, ...rest] of fields(code)) {
    if (rest.length > 0 || !label || !text || !note) return null;
    const v = readValue(text);
    if (!v || v.value < 0 || (unit !== null && v.unit !== unit)) return null;
    unit = v.unit;
    bars.push({ label, text, value: v.value, note });
  }
  if (bars.length === 0 || bars.length > MAX_BARS) return null;
  return bars.sort((a, b) => b.value - a.value);
}

/** The points in the order written, or null when one line does not parse, there are fewer than 2, or the units differ. */
export function parseLine(code: string): Point[] | null {
  const points: Point[] = [];
  let unit: string | null = null;
  for (const [x, text, ...rest] of fields(code)) {
    if (rest.length > 0 || !x || !text) return null;
    const v = readValue(text);
    if (!v || (unit !== null && v.unit !== unit)) return null;
    unit = v.unit;
    points.push({ x, text, value: v.value });
  }
  return points.length >= 2 && points.length <= MAX_POINTS ? points : null;
}

/** A `contr-chart` block; the fence's meta (`bar` or `line`) names the kind. Null when it does not parse. */
export function parseChart(meta: string | undefined, code: string): Chart | null {
  if (meta === "bar") {
    const bars = parseBars(code);
    return bars && { kind: "bar", bars };
  }
  if (meta === "line") {
    const points = parseLine(code);
    return points && { kind: "line", points };
  }
  return null;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * The index of the one outlier to label, or null. It is the point farthest from the median, when its
 * modified z-score (0.6745 × distance / median absolute distance) is above 3.5. The latest point has
 * its own label, so it is not a candidate. With fewer than 5 points there is no outlier.
 */
export function outlierOf(values: number[]): number | null {
  if (values.length < 5) return null;
  const mid = median(values);
  const dist = values.map((v) => Math.abs(v - mid));
  const mad = median(dist);
  let best: number | null = null;
  for (let i = 0; i < values.length - 1; i++) {
    if (best === null || dist[i]! > dist[best]!) best = i;
  }
  if (best === null || dist[best] === 0) return null;
  return mad === 0 || (0.6745 * dist[best]!) / mad > 3.5 ? best : null;
}
