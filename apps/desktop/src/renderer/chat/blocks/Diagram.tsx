// Draws `contr-flow` and `contr-seq` blocks as SVG (docs/design/chat-blocks.md).
// Colors come from the theme tokens (rich-parts.html, Flow and Sequence). Text width is estimated from the character count.
// A diagram sits in the middle of its box, as herdr-contr draws a mermaid image (mdblocks.js).
import { useId, type ReactNode } from "react";

import { StatusGlyph, type GlyphState } from "../../ui/StatusGlyph";
import { parseFlow, type Flow, type FlowState } from "./flow";
import { parseSeq, type Seq } from "./seq";

const CHAR = 7; // px for one character at 12 px
const LABEL_CHAR = 6.5; // px for one character of an 11 px label

/** The mark before a box's name (rich-parts.html, Flow): ✓ done, ✕ failed, the status glyph while it runs or waits. */
const MARK: Partial<Record<FlowState, string>> = { done: "✓", failed: "✕" };
const GLYPH: Partial<Record<FlowState, GlyphState>> = { running: "working", waiting: "waiting" };

/** The drawing for a diagram block, or null when the block shows as code. */
export function diagramFor(language: string, code: string): ReactNode {
  if (language === "contr-flow") {
    const flow = parseFlow(code);
    return flow && <Frame kind={language}><FlowView flow={flow} /></Frame>;
  }
  if (language === "contr-seq") {
    const seq = parseSeq(code);
    return seq && <Frame kind={language}><SeqView seq={seq} /></Frame>;
  }
  return null;
}

/** No box: the diagram sits on the answer, as the mock and the charts do. */
function Frame({ kind, children }: { kind: string; children: ReactNode }) {
  return (
    <div className="chat-diagram my-[0.65rem] overflow-x-auto py-1" data-diagram={kind}>
      {children}
    </div>
  );
}

function Arrowhead({ id, fill = "var(--ink-45)" }: { id: string; fill?: string }) {
  return (
    <marker id={id} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L8,4 L0,8 z" style={{ fill }} />
    </marker>
  );
}

const LINE = { stroke: "var(--ink-30)", strokeWidth: 1, fill: "none" } as const;
const LABEL = { fill: "var(--color-dim)", fontSize: 11 } as const;

/** Steps go left to right; boxes of one step stack. Back arrows loop below the boxes, dashed. */
function FlowView({ flow }: { flow: Flow }) {
  const arrow = useId();
  const marked = flow.nodes.some((n) => n.state && (MARK[n.state] || GLYPH[n.state]));
  const boxW = Math.max(72, Math.max(...flow.nodes.map((n) => n.name.length)) * CHAR + 28 + (marked ? 16 : 0));
  const layer = new Map(flow.nodes.map((n) => [n.name, n.layer]));
  const isBack = (e: { from: string; to: string }) => layer.get(e.to)! <= layer.get(e.from)!;
  const fwdLabel = Math.max(0, ...flow.edges.filter((e) => e.label && !isBack(e)).map((e) => e.label!.length * LABEL_CHAR + 12));
  const boxH = 34, gapX = Math.max(26, fwdLabel), gapY = 16, loop = 22, loopStep = 16;
  const pos = new Map(flow.nodes.map((n) => {
    const inLayer = flow.nodes.filter((m) => m.layer === n.layer).length;
    const top = ((flow.width - inLayer) * (boxH + gapY)) / 2;
    return [n.name, { x: n.layer * (boxW + gapX), y: top + n.slot * (boxH + gapY), node: n }];
  }));
  const bottom = flow.width * (boxH + gapY) - gapY;
  const backs = flow.edges.filter(isBack);
  const width = flow.layers * (boxW + gapX) - gapX + 1;
  const height = bottom + (backs.length ? loop + (backs.length - 1) * loopStep + 18 : 0);
  return (
    <svg role="img" aria-label="Flow diagram" width={width} height={height + 2} viewBox={`0 -1 ${width} ${height + 2}`} className="mx-auto block">
      <defs><Arrowhead id={arrow} /></defs>
      {flow.edges.map((e, i) => {
        const a = pos.get(e.from)!, b = pos.get(e.to)!;
        const back = isBack(e);
        let d: string, lx: number, ly: number;
        if (!back) {
          const [x1, y1, x2, y2] = [a.x + boxW, a.y + boxH / 2, b.x - 1, b.y + boxH / 2];
          const mid = (x1 + x2) / 2;
          d = y1 === y2 ? `M${x1},${y1} H${x2}` : `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`;
          [lx, ly] = [mid, Math.min(y1, y2) - 5];
        } else {
          // Under the boxes, from the bottom of one box to the bottom of the other; a self arrow is a small loop.
          const self = a === b;
          const [x1, x2] = [a.x + boxW / 2 + (self ? 12 : 0), b.x + boxW / 2 - (self ? 12 : 0)];
          const dip = bottom + loop + backs.indexOf(e) * loopStep;
          const [y1, y2] = [a.y + boxH, b.y + boxH + 1];
          d = `M${x1},${y1} C${x1},${dip} ${x2},${dip} ${x2},${y2}`;
          // The curve's lowest point (t = 0.5), and the label under it.
          [lx, ly] = [(x1 + x2) / 2, (y1 + y2) / 8 + (dip * 3) / 4 + 13];
        }
        return (
          <g key={i} data-edge={`${e.from}->${e.to}`}>
            <path d={d} style={LINE} strokeDasharray={back ? "3 3" : undefined} markerEnd={`url(#${arrow})`} />
            {e.label && <text x={lx} y={ly} textAnchor="middle" style={LABEL}>{e.label}</text>}
          </g>
        );
      })}
      {[...pos.values()].map(({ x, y, node }) => {
        const mark = node.state && MARK[node.state];
        const glyph = node.state && GLYPH[node.state];
        const ink = node.state === "done" ? "var(--color-dim)" : node.state === "running" ? "var(--ink-100)" : "var(--ink-85)";
        // The name follows the mark, as in the mock; a box with no mark has no empty slot.
        const tx = x + 14 + (mark || glyph ? 16 : 0);
        return (
          <g key={node.name} data-node={node.name} data-state={node.state}>
            <rect x={x + 0.5} y={y + 0.5} width={boxW - 1} height={boxH - 1} rx={8}
              style={{ fill: "none", stroke: node.state === "running" ? "var(--ink-60)" : "var(--tick)" }} />
            {mark && <text x={x + 14} y={y + boxH / 2 + 4} style={{ fill: ink, fontSize: 12 }} aria-hidden>{mark}</text>}
            {glyph && (
              <foreignObject x={x + 12} y={y + boxH / 2 - 8} width={16} height={16}>
                <StatusGlyph state={glyph} />
              </foreignObject>
            )}
            <text x={tx} y={y + boxH / 2 + 4} style={{ fill: ink, fontSize: 12 }}>{node.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** A message to the owner (`you` or `owner`) is red: red only means "needs you". */
const toOwner = (actor: string) => actor === "you" || actor === "owner";

function SeqView({ seq }: { seq: Seq }) {
  const [arrow, red] = [useId(), useId()];
  const longest = Math.max(...seq.messages.map((m) => m.text.length));
  const colW = Math.max(120, Math.max(...seq.actors.map((a) => a.length)) * CHAR + 24, longest * LABEL_CHAR + 24);
  const head = 22, row = 30, selfW = 34, selfH = 14;
  const ys: number[] = [];
  let y = head + 24;
  for (const m of seq.messages) {
    ys.push(y);
    y += row + (m.from === m.to ? 10 : 0);
  }
  const width = seq.actors.length * colW + longest * LABEL_CHAR;
  const height = y - row + 16;
  const cx = (a: string) => seq.actors.indexOf(a) * colW + colW / 2;
  return (
    <svg role="img" aria-label="Sequence diagram" width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="mx-auto block">
      <defs><Arrowhead id={arrow} fill="var(--ink-50)" /><Arrowhead id={red} fill="var(--blocked)" /></defs>
      {seq.actors.map((a) => (
        <g key={a} data-actor={a}>
          <line x1={cx(a)} y1={head} x2={cx(a)} y2={height} style={{ ...LINE, stroke: "var(--tick)" }} />
          <text x={cx(a)} y={14} textAnchor="middle" style={{ fill: "var(--ink-85)", fontSize: 12 }}>{a}</text>
        </g>
      ))}
      {seq.messages.map((m, i) => {
        const y = ys[i]!;
        const [x1, x2] = [cx(m.from), cx(m.to)];
        const owner = toOwner(m.to) && m.from !== m.to;
        const line = { ...LINE, stroke: owner ? "var(--blocked)" : "var(--ink-40)", strokeDasharray: m.reply ? "3 3" : undefined };
        const text = { ...LABEL, fill: owner ? "var(--blocked)" : "var(--color-muted)" };
        return (
          <g key={i} data-message={m.text} data-reply={m.reply || undefined} data-owner={owner || undefined}>
            {x1 === x2 ? (
              <>
                <path d={`M${x1},${y} h${selfW} v${selfH} h${-selfW + 4}`} style={line} markerEnd={`url(#${arrow})`} />
                <text x={x1 + selfW + 8} y={y + 11} style={text}>{m.text}</text>
              </>
            ) : (
              <>
                <line x1={x1} y1={y} x2={x2 + (x2 > x1 ? -4 : 4)} y2={y} style={line} markerEnd={`url(#${owner ? red : arrow})`} />
                <text x={(x1 + x2) / 2} y={y - 6} textAnchor="middle" style={text}>{m.text}</text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
