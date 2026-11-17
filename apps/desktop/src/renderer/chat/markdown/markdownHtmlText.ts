/**
 * Raw HTML shows as its source text (docs/design/chat-blocks.md, "What the chat does not
 * show"). An HTML block becomes a paragraph with its lines; inline HTML becomes text.
 */
interface MdNode {
  type?: string;
  value?: unknown;
  children?: MdNode[];
}

const FLOW_PARENTS = new Set(["root", "blockquote", "listItem", "footnoteDefinition"]);

function sourceParagraph(value: string): MdNode {
  const children: MdNode[] = [];
  value.split("\n").forEach((line, i) => {
    if (i > 0) children.push({ type: "break" });
    children.push({ type: "text", value: line });
  });
  return { type: "paragraph", children };
}

export function remarkHtmlAsText() {
  return (tree: MdNode) => {
    const visit = (node: MdNode) => {
      if (!node.children) return;
      node.children = node.children.map((child) => {
        if (child.type !== "html") return child;
        const value = String(child.value ?? "");
        return FLOW_PARENTS.has(node.type ?? "") ? sourceParagraph(value) : { type: "text", value };
      });
      node.children.forEach(visit);
    };
    visit(tree);
  };
}
