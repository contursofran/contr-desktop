import type { Parent, PhrasingContent, Root, Text } from "mdast";

/** `#12` after a start, a space or punctuation, and not part of a word, URL or entity. */
const REF = /(?<![\w&/#])#(\d{1,7})(?!\w)/g;

/** Splits text into text and `contr-ref` nodes. Text in links, inline code and code blocks stays text. */
export function remarkRefs() {
  return (tree: Root) => {
    const visit = (node: Parent) => {
      if (node.type === "link" || node.type === "linkReference") return;
      const children: unknown[] = [];
      for (const child of node.children) {
        if (child.type === "text") children.push(...splitRefs(child));
        else {
          if ("children" in child) visit(child);
          children.push(child);
        }
      }
      node.children = children as Parent["children"];
    };
    visit(tree);
  };
}

export function splitRefs(node: Text): PhrasingContent[] {
  const out: PhrasingContent[] = [];
  let last = 0;
  for (const m of node.value.matchAll(REF)) {
    if (m.index > last) out.push({ type: "text", value: node.value.slice(last, m.index) });
    out.push({
      type: "text",
      value: m[0],
      data: { hName: "contr-ref", hProperties: { dataRef: m[1] }, hChildren: [{ type: "text", value: m[0] }] },
    });
    last = m.index + m[0].length;
  }
  if (last === 0) return [node];
  if (last < node.value.length) out.push({ type: "text", value: node.value.slice(last) });
  return out;
}
