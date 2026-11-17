import type { Element } from "hast";
import { Component, Suspense, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { diagramFor } from "../blocks/Diagram";
import { DiffCode, HighlightedCode, MarkdownCodeBlock, extractFenceLanguage, isDiffLanguage } from "./MarkdownCodeBlock";
import { contrBlock } from "../blocks/contrBlock";
import { RefChip } from "../refs/RefChip";
import { MarkdownTable } from "./MarkdownTable";
import { createMarkdownRenderer } from "./markdownRenderer";
import { CHAT_MARKDOWN_REHYPE_PLUGINS, CHAT_MARKDOWN_REMARK_PLUGINS } from "./pipeline";
import { useColorScheme } from "./useColorScheme";
import "./markdown.css";

type WithNode<T extends keyof React.JSX.IntrinsicElements> = ComponentProps<T> & { node?: Element };

function textOf(node: Element | undefined): string {
  if (!node) return "";
  return node.children
    .map((child) => (child.type === "text" ? child.value : child.type === "element" ? textOf(child) : ""))
    .join("");
}

/** Shows the plain code when the highlighter fails to load. */
class PlainOnError extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Pre({ node, children }: WithNode<"pre">) {
  const theme = useColorScheme();
  const codeNode = node?.children.find((c): c is Element => c.type === "element" && c.tagName === "code");
  const className = codeNode?.properties.className;
  const language = extractFenceLanguage(Array.isArray(className) ? className.join(" ") : undefined);
  const code = textOf(codeNode);
  const block = contrBlock(language, code);
  if (block) return block;
  const plain = <pre>{children}</pre>;
  const diagram = diagramFor(language, code);
  if (diagram) return diagram;
  if (isDiffLanguage(language)) {
    return (
      <MarkdownCodeBlock code={code} language={language}>
        <DiffCode code={code} />
      </MarkdownCodeBlock>
    );
  }
  return (
    <MarkdownCodeBlock code={code} language={language}>
      <PlainOnError fallback={plain}>
        <Suspense fallback={plain}>
          <HighlightedCode code={code} language={language} theme={theme} />
        </Suspense>
      </PlainOnError>
    </MarkdownCodeBlock>
  );
}

function Link({ node, ...props }: WithNode<"a">) {
  void node;
  return <a {...props} target="_blank" rel="noreferrer" />;
}

function Table({ node, ...props }: WithNode<"table">) {
  void node;
  return <MarkdownTable {...props} />;
}

/** The path of a `contr-image:` URL (markdownLocalImages.ts), or the URL itself. */
function imagePath(src: string): string {
  const local = src.replace(/^contr-image:\/\/local/, "");
  return local === src ? src : local.split("/").map(decodeURIComponent).join("/");
}

/** A local image; when the file cannot load, its alt text (else its path) as text, as herdr-contr shows it. */
function Img({ node, ...props }: WithNode<"img">) {
  void node;
  const [missing, setMissing] = useState(false);
  if (!missing) return <img {...props} onError={() => setMissing(true)} />;
  return <span data-missing-image="">{props.alt || imagePath(String(props.src ?? ""))}</span>;
}

/** `contr-ref` from remarkRefs: a PR or issue number. */
function Ref({ node, children }: { node?: Element; children?: ReactNode }) {
  return <RefChip number={Number(node?.properties.dataRef)}>{children}</RefChip>;
}

/** Words for remark tags (docs/design/chat-blocks.md, Remarks) and GitHub's alerts. */
const REMARK_WORDS: Record<string, string> = {
  done: "Done",
  decision: "Decision needed",
  warning: "Warning",
  unverified: "Not verified",
  note: "Note",
  tip: "Tip",
  important: "Important",
  caution: "Caution",
};

function Blockquote({ node, children, ...props }: WithNode<"blockquote">) {
  const alert = node?.properties.dataAlert;
  const word = typeof alert === "string" ? REMARK_WORDS[alert] : undefined;
  if (!word) return <blockquote {...props}>{children}</blockquote>;
  return (
    <blockquote {...props} className="chat-remark">
      <p className="chat-remark-word">{word}</p>
      {children}
    </blockquote>
  );
}

const SAFE_URL = /^(?:https?:|mailto:|#|\/|contr-image:\/\/local\/)/i;

/** Keeps web links and drops other schemes, as react-markdown's default does. */
function urlTransform(url: string): string {
  return SAFE_URL.test(url) || !/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : "";
}

/** Element to component map. */
const render = createMarkdownRenderer({
  remarkPlugins: CHAT_MARKDOWN_REMARK_PLUGINS,
  rehypePlugins: CHAT_MARKDOWN_REHYPE_PLUGINS,
  components: { pre: Pre, a: Link, img: Img, table: Table, blockquote: Blockquote, "contr-ref": Ref },
  urlTransform,
});

/** An agent's Markdown text, as t3code's chat shows it. */
export function ChatMarkdown({ text }: { text: string }) {
  const element = useMemo(() => render(text), [text]);
  return <div className="chat-markdown">{element}</div>;
}
