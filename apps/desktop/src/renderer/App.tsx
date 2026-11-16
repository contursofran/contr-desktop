import { useState } from "react";
import { TerminalView } from "./terminal/TerminalView";

type Side = "chat" | "terminal";

export function App() {
  // The top strip is the drag area of the hidden title bar. The Chat / Terminal switch sits at its right.
  const [side, setSide] = useState<Side>("chat");
  const tab = (s: Side, label: string) => (
    <button
      type="button"
      aria-pressed={side === s}
      onClick={() => setSide(s)}
      className={`rounded px-2.5 py-0.5 text-xs ${side === s ? "bg-selected text-foreground" : "text-muted hover:bg-hover"}`}
    >
      {label}
    </button>
  );
  return (
    <main className="flex h-screen flex-col bg-canvas text-foreground">
      <div className="flex h-10 shrink-0 items-center justify-end px-3 [-webkit-app-region:drag]">
        <div role="group" aria-label="Chat or Terminal" className="flex gap-0.5 rounded-md border border-border bg-raised p-0.5 [-webkit-app-region:no-drag]">
          {tab("chat", "Chat")}
          {tab("terminal", "Terminal")}
        </div>
      </div>
      {side === "chat" ? (
        <div className="flex flex-1 items-center justify-center text-sm text-dim">The chat comes in a later step.</div>
      ) : (
        <TerminalView />
      )}
    </main>
  );
}
