// Draws `contr-flow` and `contr-seq` blocks as SVG (docs/design/chat-blocks.md).
// Colors come from the theme tokens. Text width is estimated from the character count.
import { useId, type ReactNode } from "react";

import { parseFlow, type Flow, type FlowState } from "./flow";
import { parseSeq, type Seq } from "./seq";

const CHAR = 7; // px for one character at 12 px
const STATE_COLOR: Record<FlowState, string> = {
  done: "var(--color-done)",
  running: "var(--color-working)",
  waiting: "var(--color-blocked)",
  failed: "var(--color-pr-closed)",
  info: "var(--color-muted)",
};

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

function Frame({ kind, children }: { kind: string; children: ReactNode }) {
  return (
    <div className="chat-diagram my-[0.65rem] overflow-x-auto rounded-lg border border-border bg-raised p-3" data-diagram={kind}>
      {children}
    </div>
  );
}

function Arrowhead({ id }: { id: string }) {
  return (
    <marker id={id} viewBox="0 0 8 8" refX="8" refY="4" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M0,0 L8,4 L0,8 z" style={{ fill: "var(--color-muted)" }} />
    </marker>
  );
}

const LINE = { stroke: "var(--color-muted)", strokeWidth: 1, fill: "none" } as const;
const LABEL = { fill: "var(--color-muted)", fontSize: 11, paintOrder: "stroke", stroke: "var(--color-raised)", strokeWidth: 4 } as const;

function FlowView({ flow }: { flow: Flow }) {
  const arrow = useId();
  const boxW = Math.max(72, Math.max(...flow.nodes.map((n) => n.name.length)) * CHAR + 32);
  const boxH = 28, gapX = 32, gapY = 52, side = 48;
  const width = flow.width * (boxW + gapX) - gapX + side;
  const height = flow.layers * (boxH + gapY) - gapY;
  const pos = new Map(flow.nodes.map((n) => {
    const inLayer = flow.nodes.filter((m) => m.layer === n.layer).length;
    const left = ((flow.width - inLayer) * (boxW + gapX)) / 2;
    return [n.name, { x: left + n.slot * (boxW + gapX), y: n.layer * (boxH + gapY), node: n }];
  }));
  return (
    <svg role="img" aria-label="Flow diagram" width={width} height={height + 2} viewBox={`0 -1 ${width} ${height + 2}`} className="block">
      <defs><Arrowhead id={arrow} /></defs>
      {flow.edges.map((e, i) => {
        const a = pos.get(e.from)!, b = pos.get(e.to)!;
        let d: string, lx: number, ly: number;
        if (b.y > a.y) {
          const [x1, y1, x2, y2] = [a.x + boxW / 2, a.y + boxH, b.x + boxW / 2, b.y];
          d = `M${x1},${y1} L${x2},${y2}`;
          [lx, ly] = [(x1 + x2) / 2, (y1 + y2) / 2 + 4];
        } else {
          // Back, same-layer and self arrows go round the right side.
          const [x1, y1, x2, y2] = [a.x + boxW, a.y + boxH / 2, b.x + boxW, b.y + boxH / 2 + (a === b ? 8 : 0)];
          const out = Math.max(x1, x2) + side * 0.6;
          d = `M${x1},${y1} C${out},${y1} ${out},${y2} ${x2},${y2}`;
          [lx, ly] = [out - 12, (y1 + y2) / 2 + 4];
        }
        return (
          <g key={i} data-edge={`${e.from}->${e.to}`}>
            <path d={d} style={LINE} markerEnd={`url(#${arrow})`} />
            {e.label && <text x={lx} y={ly} textAnchor="middle" style={LABEL}>{e.label}</text>}
          </g>
        );
      })}
      {[...pos.values()].map(({ x, y, node }) => (
        <g key={node.name} data-node={node.name} data-state={node.state}>
          <rect x={x + 0.5} y={y + 0.5} width={boxW - 1} height={boxH - 1} rx={6}
            style={{ fill: "var(--color-canvas)", stroke: node.state ? STATE_COLOR[node.state] : "var(--color-border)" }} />
          {node.state && <circle cx={x + 12} cy={y + boxH / 2} r={3.5} style={{ fill: STATE_COLOR[node.state] }} />}
          <text x={x + boxW / 2} y={y + boxH / 2 + 4} textAnchor="middle" style={{ fill: "var(--color-foreground)", fontSize: 12 }}>
            {node.name}
          </text>
        </g>
      ))}
    </svg>
  );
}

function SeqView({ seq }: { seq: Seq }) {
  const arrow = useId();
  const longest = Math.max(...seq.messages.map((m) => m.text.length));
  const colW = Math.max(120, Math.max(...seq.actors.map((a) => a.length)) * CHAR + 24, longest * 6.5 + 24);
  const head = 28, row = 32, selfW = 24;
  const width = seq.actors.length * colW + longest * 6.5;
  const height = head + 12 + seq.messages.length * row;
  const cx = (a: string) => seq.actors.indexOf(a) * colW + colW / 2;
  return (
    <svg role="img" aria-label="Sequence diagram" width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
      <defs><Arrowhead id={arrow} /></defs>
      {seq.actors.map((a) => {
        const w = a.length * CHAR + 24;
        return (
          <g key={a} data-actor={a}>
            <line x1={cx(a)} y1={head} x2={cx(a)} y2={height} style={{ ...LINE, stroke: "var(--color-border)" }} strokeDasharray="3 3" />
            <rect x={cx(a) - w / 2 + 0.5} y={0.5} width={w - 1} height={head - 1} rx={6}
              style={{ fill: "var(--color-canvas)", stroke: "var(--color-border)" }} />
            <text x={cx(a)} y={head / 2 + 4} textAnchor="middle" style={{ fill: "var(--color-foreground)", fontSize: 12 }}>{a}</text>
          </g>
        );
      })}
      {seq.messages.map((m, i) => {
        const y = head + 12 + i * row + row - 8;
        const [x1, x2] = [cx(m.from), cx(m.to)];
        const line = { ...LINE, strokeDasharray: m.reply ? "4 3" : undefined };
        return (
          <g key={i} data-message={m.text} data-reply={m.reply || undefined}>
            {x1 === x2 ? (
              <>
                <path d={`M${x1},${y - 12} h${selfW} v12 h${-selfW}`} style={line} markerEnd={`url(#${arrow})`} />
                <text x={x1 + selfW + 6} y={y - 2} style={LABEL}>{m.text}</text>
              </>
            ) : (
              <>
                <line x1={x1} y1={y} x2={x2 + (x2 > x1 ? -1 : 1)} y2={y} style={line} markerEnd={`url(#${arrow})`} />
                <text x={(x1 + x2) / 2} y={y - 6} textAnchor="middle" style={LABEL}>{m.text}</text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
