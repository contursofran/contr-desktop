import { outlierOf, type Bar, type Chart, type ChartTitle, type Point } from "./chart";

/** Grey bars, largest first, each with its label, and its value and note as text. */
function BarChart({ bars }: { bars: Bar[] }) {
  const max = Math.max(...bars.map((b) => b.value)) || 1;
  return (
    <ul aria-label="Bar chart" className="contr-chart my-3 grid list-none grid-cols-[minmax(40px,max-content)_minmax(0,1fr)_120px] items-center gap-x-3 gap-y-1.5 p-0 leading-[14px]" style={{ paddingInlineStart: 0, marginInline: 0 }}>
      {bars.map((bar, i) => (
        <li key={`${i}-${bar.label}`} className="contents">
          <span className="font-mono text-[11px] text-dim">{bar.label}</span>
          <span className="relative h-2 overflow-hidden rounded-[2px] bg-ink-26">
            <span data-testid="bar" className="absolute inset-y-0 left-0 rounded-[2px] bg-ink-60" style={{ width: `${(bar.value / max) * 100}%` }} />
          </span>
          <span className="text-right font-mono text-[11px] text-muted [overflow-wrap:anywhere]">{bar.text} · {bar.note}</span>
        </li>
      ))}
    </ul>
  );
}

const W = 600;
const H = 64;
const VIEW_WIDTH = W + 66;

/** The value of a labelled point, with its note: "9.4 · #31". */
const label = (p: Point) => (p.note ? `${p.text} · ${p.note}` : p.text);

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
  const outlierLabel = out === null ? "" : label(points[out]!);
  // Keep an edge point's label in the SVG. JetBrains Mono advances by 0.6 em.
  const outlierHalfWidth = Math.min(outlierLabel.length * 10.5 * 0.3, VIEW_WIDTH / 2);
  return (
    <svg role="img" aria-label={`Line chart, ${points.length} points, latest ${latest.x}: ${latest.text}`} viewBox={`-6 -22 ${VIEW_WIDTH} ${H + 42}`} width="100%" style={{ maxWidth: VIEW_WIDTH }} className="contr-chart my-3 block font-mono">
      <path d={`M0 ${H}H${W}`} className="stroke-hairline" />
      <polyline points={xy.map((p) => p.join(",")).join(" ")} fill="none" strokeWidth={1.5} strokeLinejoin="round" className="stroke-ink-60" />
      {xy.map(([x, y], i) => (
        <circle key={i} data-testid={i === last ? "latest" : i === out ? "outlier" : undefined} cx={x} cy={y} r={i === last || i === out ? 3 : 1.6} className={i === last ? "fill-ink-100" : "fill-ink-60"} />
      ))}
      {out !== null && (
        <text data-testid="outlier-label" x={Math.min(Math.max(xy[out]![0], outlierHalfWidth - 6), VIEW_WIDTH - 6 - outlierHalfWidth)} y={high ? xy[out]![1] - 8 : xy[out]![1] + 16} fontSize={10.5} textAnchor="middle" className="fill-muted">{outlierLabel}</text>
      )}
      <text data-testid="latest-label" x={latest.note ? W : W + 8} y={xy[last]![1] + (latest.note ? -8 : 4)} fontSize={11} textAnchor={latest.note ? "end" : undefined} className="fill-ink-100">{label(latest)}</text>
      <text x={0} y={H + 16} fontSize={10.5} className="fill-dim">{points[0]!.x}</text>
      <text x={W} y={H + 16} fontSize={10.5} textAnchor="end" className="fill-dim">{latest.x}</text>
    </svg>
  );
}

/** The title above a chart, with its quieter mono part. */
function Title({ title }: { title: ChartTitle }) {
  return (
    <div data-testid="chart-title" className="mt-3 flex items-baseline gap-2.5 text-[12.5px] leading-[21px] text-ink-85">
      {title.text}
      {title.sub ? <span className="font-mono text-[11px] leading-[14px] text-dim">{title.sub}</span> : null}
    </div>
  );
}

/** A `contr-chart` block: a bar chart or a line chart, with an optional title. */
export function ChartBlock({ chart }: { chart: Chart }) {
  const body = chart.kind === "bar" ? <BarChart bars={chart.bars} /> : <LineChart points={chart.points} />;
  if (!chart.title) return body;
  return (
    <>
      <Title title={chart.title} />
      {body}
    </>
  );
}
