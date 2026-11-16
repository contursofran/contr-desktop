// Copied in part from t3code packages/shared/src/markdownPipeline.ts at the commit in
// THIRD_PARTY_NOTICES.md (MIT). Changes: only the sanitize schema, the code-meta and
// inline-code plugins and the plugin lists; no raw HTML, images, file, thread or
// Windows-path links, Codex directives or autolink fixes. INLINE_TEXT_PLUGINS is ours.
import type { PluggableList } from "unified";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { remarkRefs } from "../refs/remarkRefs";
import { remarkGithubAlerts } from "./markdownGithubAlerts";
import { remarkNormalizeListItemIndentation } from "./markdownListIndentation";
import { remarkKeepOrderedListNumbers } from "./markdownOrderedListNumbers";

interface MarkdownAstNode {
  type?: string;
  url?: unknown;
  meta?: unknown;
  data?: { hProperties?: Record<string, unknown> };
  children?: MarkdownAstNode[];
}

function remarkPreserveCodeMeta() {
  return (tree: MarkdownAstNode) => {
    const visit = (node: MarkdownAstNode) => {
      if (node.type === "code" && typeof node.meta === "string" && node.meta.trim().length > 0) {
        node.data = {
          ...node.data,
          hProperties: {
            ...node.data?.hProperties,
            dataCodeMeta: node.meta.trim(),
          },
        };
      }
      node.children?.forEach(visit);
    };

    visit(tree);
  };
}

function remarkNormalizeLinksAndTagInlineCode() {
  return (tree: MarkdownAstNode) => {
    const visit = (node: MarkdownAstNode, insideLink: boolean) => {
      if (
        (node.type === "link" || node.type === "definition") &&
        typeof node.url === "string" &&
        /^[A-Za-z]:[\\/]/.test(node.url)
      ) {
        node.url = `file:///${node.url.replaceAll("\\", "/")}`;
      }
      if (node.type === "inlineCode" && !insideLink) {
        node.data = {
          ...node.data,
          hProperties: {
            ...node.data?.hProperties,
            dataInlineCode: "",
          },
        };
      }
      const childInsideLink = insideLink || node.type === "link" || node.type === "linkReference";
      node.children?.forEach((child) => visit(child, childInsideLink));
    };

    visit(tree, false);
  };
}

/**
 * The place for inline text transforms (issue #4, PR and issue chips): remark plugins
 * that run after GFM and before the tree becomes HTML. A plugin can turn text nodes into
 * nodes with `data.hName` and `data.hProperties`; add those names to the sanitize
 * schema below and map them to a component in ChatMarkdown.tsx.
 */
export const INLINE_TEXT_PLUGINS: PluggableList = [remarkRefs];

const CHAT_MARKDOWN_SANITIZE_SCHEMA = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "contr-ref"],
  attributes: {
    ...defaultSchema.attributes,
    "*": (defaultSchema.attributes?.["*"] ?? []).filter((attribute) => attribute !== "title"),
    code: [["className", /^language-./], "dataCodeMeta", "dataInlineCode"],
    blockquote: [...(defaultSchema.attributes?.blockquote ?? []), "dataAlert"],
    "contr-ref": [["dataRef", /^\d+$/]],
  },
} satisfies Parameters<typeof rehypeSanitize>[0];

export const CHAT_MARKDOWN_REMARK_PLUGINS: PluggableList = [
  remarkGfm,
  remarkGithubAlerts,
  remarkKeepOrderedListNumbers,
  remarkNormalizeListItemIndentation,
  remarkPreserveCodeMeta,
  remarkNormalizeLinksAndTagInlineCode,
  ...INLINE_TEXT_PLUGINS,
];

export const CHAT_MARKDOWN_REHYPE_PLUGINS: PluggableList = [
  [rehypeSanitize, CHAT_MARKDOWN_SANITIZE_SCHEMA],
];
