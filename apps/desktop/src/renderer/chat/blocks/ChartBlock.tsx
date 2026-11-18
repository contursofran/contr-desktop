import { outlierOf, type Bar, type Chart, type Point } from "./chart";

/** Grey bars, largest first, each with its label, and its value and note as text. */
function BarChart({ bars }: { bars: Bar[] }) {
  const max = Math.max(...bars.map((b) => b.value)) || 1;
  return (
    <ul aria-label="Bar chart" className="contr-chart my-3 grid list-none grid-cols-[minmax(40px,max-content)_1fr_max-content] items-center gap-x-3 gap-y-1.5 p-0" style={{ paddingInlineStart: 0, marginInline: 0 }}>
      {bars.map((bar, i) => (
        <li key={`${i}-${bar.label}`} className="contents">
          <span className="font-mono text-[11px] text-dim">{bar.label}</span>
          <span className="relative h-2 overflow-hidden rounded-[2px] bg-ink-26">
            <span data-testid="bar" className="absolute inset-y-0 left-0 rounded-[2px] bg-ink-60" style={{ width: `${(bar.value / max) * 100}%` }} />
          </span>
          <span className="text-right font-mono text-[11px] text-muted">{bar.text} · {bar.note}</span>
        </li>
      ))}
    </ul>
  );
}

const W = 600;
const H = 64;

/** One line; the latest point is the brightest and has its value at the right; one outlier has a label. */
function LineChart({ points }: { points: Point[] }) {
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const span = Math.max(...values) - lo || 1;
  const xy = points.map((p, i) => [(i * W) / (points.length - 1), H - ((p.value - lo) / span) * H] as const);
  const last = points.length - 1;
  const out = outlierOf(values);
  const high = out !== null && values[out]! >= values[last]!;
  const latest = points[last]!;
  return (
    <svg role="img" aria-label={`Line chart, ${points.length} points, latest ${latest.x}: ${latest.text}`} viewBox={`-6 -22 ${W + 66} ${H + 42}`} width="100%" className="contr-chart my-3 block font-mono">
      <path d={`M0 ${H}H${W}`} className="stroke-hairline" />
      <polyline points={xy.map((p) => p.join(",")).join(" ")} fill="none" strokeWidth={1.5} strokeLinejoin="round" className="stroke-ink-60" />
      {xy.map(([x, y], i) => (
        <circle key={i} data-testid={i === last ? "latest" : i === out ? "outlier" : undefined} cx={x} cy={y} r={i === last || i === out ? 3 : 1.6} className={i === last ? "fill-ink-100" : "fill-ink-60"} />
      ))}
      {out !== null && (
        <text data-testid="outlier-label" x={xy[out]![0]} y={high ? xy[out]![1] - 8 : xy[out]![1] + 16} fontSize={10.5} textAnchor="middle" className="fill-muted">{points[out]!.text}</text>
      )}
      <text data-testid="latest-label" x={W + 8} y={xy[last]![1] + 4} fontSize={11} className="fill-ink-100">{latest.text}</text>
      <text x={0} y={H + 16} fontSize={10.5} className="fill-dim">{points[0]!.x}</text>
      <text x={W} y={H + 16} fontSize={10.5} textAnchor="end" className="fill-dim">{latest.x}</text>
    </svg>
  );
}

/** A `contr-chart` block: a bar chart or a line chart. */
export function ChartBlock({ chart }: { chart: Chart }) {
  return chart.kind === "bar" ? <BarChart bars={chart.bars} /> : <LineChart points={chart.points} />;
}
