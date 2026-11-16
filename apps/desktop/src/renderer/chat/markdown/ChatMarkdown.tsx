import type { Element } from "hast";
import { Component, Suspense, useMemo, type ComponentProps, type ReactNode } from "react";
import { HighlightedCode, MarkdownCodeBlock, extractFenceLanguage } from "./MarkdownCodeBlock";
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
  const plain = <pre>{children}</pre>;
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

/** `contr-ref` from remarkRefs: a PR or issue number. */
function Ref({ node, children }: { node?: Element; children?: ReactNode }) {
  return <RefChip number={Number(node?.properties.dataRef)}>{children}</RefChip>;
}

const SAFE_URL = /^(?:https?:|mailto:|#|\/)/i;

/** Keeps web links and drops other schemes, as react-markdown's default does. */
function urlTransform(url: string): string {
  return SAFE_URL.test(url) || !/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : "";
}

/** Element to component map. */
const render = createMarkdownRenderer({
  remarkPlugins: CHAT_MARKDOWN_REMARK_PLUGINS,
  rehypePlugins: CHAT_MARKDOWN_REHYPE_PLUGINS,
  components: { pre: Pre, a: Link, table: Table, "contr-ref": Ref },
  urlTransform,
});

/** An agent's Markdown text, as t3code's chat shows it. */
export function ChatMarkdown({ text }: { text: string }) {
  const element = useMemo(() => render(text), [text]);
  return <div className="chat-markdown">{element}</div>;
}
