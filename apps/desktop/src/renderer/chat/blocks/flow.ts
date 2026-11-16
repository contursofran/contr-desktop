// Parse and layout for `contr-flow` blocks (docs/design/chat-blocks.md).
// A block past a limit, or one that does not parse, gives null: it shows as code.

export const FLOW_STATES = ["done", "running", "waiting", "failed", "info"] as const;
export type FlowState = (typeof FLOW_STATES)[number];

export const FLOW_LIMITS = { boxes: 12, depth: 6, width: 4, name: 28 } as const;

export interface FlowEdge { from: string; to: string; label?: string }
export interface FlowNode { name: string; state?: FlowState; layer: number; slot: number }
export interface Flow { nodes: FlowNode[]; edges: FlowEdge[]; layers: number; width: number }

// A name has no `:`, `[`, `]` or `->`; a chain `A -> B -> C` does not parse.
const NAME = String.raw`(?:(?!->)[^:\[\]])+?`;
const EDGE = new RegExp(String.raw`^(${NAME})\s*->\s*(${NAME})\s*(?::\s*(.*\S))?$`);
const STATE = new RegExp(String.raw`^(${NAME})\s*\[(\w+)\]$`);

export function parseFlow(source: string): Flow | null {
  const names: string[] = [];
  const states = new Map<string, FlowState>();
  const edges: FlowEdge[] = [];
  const add = (n: string) => {
    if (n.length > FLOW_LIMITS.name) return false;
    if (!names.includes(n)) names.push(n);
    return true;
  };
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const s = line.match(STATE);
    if (s) {
      const state = s[2] as FlowState;
      if (!FLOW_STATES.includes(state) || !add(s[1])) return null;
      states.set(s[1], state);
      continue;
    }
    const e = line.match(EDGE);
    if (!e || !add(e[1]) || !add(e[2])) return null;
    edges.push(e[3] ? { from: e[1], to: e[2], label: e[3].trim() } : { from: e[1], to: e[2] });
  }
  if (names.length === 0 || names.length > FLOW_LIMITS.boxes) return null;

  // Layers: breadth first from the boxes with no arrow in (or the first box).
  const layer = new Map<string, number>();
  const roots = names.filter((n) => !edges.some((e) => e.to === n && e.from !== n));
  const queue = roots.length ? [...roots] : [names[0]];
  for (const r of queue) layer.set(r, 0);
  for (let i = 0; i < queue.length || layer.size < names.length; i++) {
    if (i >= queue.length) {
      const left = names.find((n) => !layer.has(n))!;
      layer.set(left, 0);
      queue.push(left);
    }
    const at = queue[i];
    for (const e of edges) {
      if (e.from === at && !layer.has(e.to)) {
        layer.set(e.to, layer.get(at)! + 1);
        queue.push(e.to);
      }
    }
  }
  const counts: number[] = [];
  const nodes = names.map((name) => {
    const l = layer.get(name)!;
    const slot = counts[l] ?? 0;
    counts[l] = slot + 1;
    return { name, state: states.get(name), layer: l, slot };
  });
  const width = Math.max(...counts.map((c) => c ?? 0));
  if (counts.length > FLOW_LIMITS.depth || width > FLOW_LIMITS.width) return null;
  return { nodes, edges, layers: counts.length, width };
}
