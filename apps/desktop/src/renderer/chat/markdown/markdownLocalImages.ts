/**
 * `![alt](/absolute/path.png)` alone on its line becomes an image served by the
 * `contr-image:` protocol (src/main/localImages.ts). Other images become links:
 * a web URL stays a link (docs/design/chat-blocks.md, Images).
 */
interface MdNode {
  type?: string;
  url?: unknown;
  alt?: unknown;
  value?: unknown;
  children?: MdNode[];
}

export const LOCAL_IMAGE = /^\/.+\.(?:png|jpe?g|svg)$/i;

export function localImageUrl(path: string): string {
  return `contr-image://local${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function remarkLocalImages() {
  return (tree: MdNode) => {
    const visit = (node: MdNode) => {
      node.children?.forEach((child) => {
        if (child.type === "paragraph") {
          const kids = (child.children ?? []).filter((k) => !(k.type === "text" && String(k.value).trim() === ""));
          const only = kids.length === 1 ? kids[0] : undefined;
          if (only?.type === "image" && typeof only.url === "string" && LOCAL_IMAGE.test(only.url)) {
            only.url = localImageUrl(only.url);
            child.children = [only];
            return;
          }
        }
        if (child.type === "image") {
          const alt = typeof child.alt === "string" && child.alt ? child.alt : String(child.url);
          Object.assign(child, { type: "link", children: [{ type: "text", value: alt }] });
          delete child.alt;
        }
        visit(child);
      });
    };
    visit(tree);
  };
}
