import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";

/** Text blocks that take their direction from their own first strong letter (Hebrew, Arabic: right to left). */
const AUTO = new Set(["p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "td", "th", "blockquote"]);

/**
 * Sets `dir="auto"` on the text blocks, and `dir="ltr"` on code, which stays left to right.
 * A quote or a remark takes its direction from its text, so its bar is on the side where the text starts;
 * its paragraphs follow it (the browser skips children with their own `dir` when it finds a direction,
 * and the remark's word is in a `bdi`, which it skips too).
 */
export function rehypeTextDirection() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, _index, parent) => {
      if (node.tagName === "code") {
        node.properties.dir = "ltr";
        return;
      }
      if (!AUTO.has(node.tagName)) return;
      if (node.tagName === "p" && parent?.type === "element" && parent.tagName === "blockquote") return;
      node.properties.dir = "auto";
    });
  };
}
