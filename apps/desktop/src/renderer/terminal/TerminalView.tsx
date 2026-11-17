import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";
import { useColorScheme } from "../chat/markdown/useColorScheme";
import type { Sidebar } from "../../shared/api";
import { ErrorNote } from "../ui/ErrorNote";
import { terminalProblem } from "./problem";
import { terminalTheme } from "./theme";

// The agent's hc terminal in xterm.js. Keys and paste go to hc; the size follows the view.
export function TerminalView() {
  const host = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState<string | null>(null);
  const shown = useRef<Terminal>(null);
  const scheme = useColorScheme();
  const first = useRef(scheme);
  const again = useRef<(focus?: boolean) => void>(() => undefined);

  useEffect(() => {
    const el = host.current!;
    const term = new Terminal({
      fontFamily: '"SF Mono", Menlo, monospace',
      fontSize: 13,
      scrollback: 10000,
      macOptionIsMeta: true,
      theme: terminalTheme(first.current),
    });
    shown.current = term;
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    fit.fit();
    const api = window.contr.terminal;
    const offData = api.onData((b) => term.write(b));
    const offEnd = api.onEnd((r) => setNote(r));
    const attach = () => void api.attach(term.cols, term.rows).then((r) => { if (r.error) setNote(r.error); });
    // Retry attaches again: main closes the old attach, and hc sends the scrollback again into a clean screen.
    again.current = (focus = true) => {
      setNote(null);
      term.reset();
      attach();
      if (focus) term.focus();
    };
    attach();
    term.onData((d) => api.input(d));
    term.onResize(({ cols, rows }) => api.resize(cols, rows));
    const ro = new ResizeObserver(() => fit.fit());
    ro.observe(el);
    term.focus();
    return () => {
      offData();
      offEnd();
      ro.disconnect();
      term.dispose();
      shown.current = null;
    };
  }, []);

  // hc comes back after an outage (the sidebar's hcError clears): a shown note attaches again, as Retry does, but focus stays where it is.
  // Only the change from failing to working attaches, once: while hc fails there is no attach, so no loop.
  const noteShown = useRef(false);
  useEffect(() => {
    noteShown.current = note !== null;
  }, [note]);
  useEffect(() => {
    let down = false;
    const follow = (s: Sidebar) => {
      if (s.hcError !== undefined) down = true;
      else if (down) {
        down = false;
        if (noteShown.current) again.current(false);
      }
    };
    void window.contr.sidebar().then(follow);
    return window.contr.onSidebar(follow);
  }, []);

  // The colors follow the system appearance, as the theme tokens do.
  useEffect(() => {
    if (shown.current) shown.current.options.theme = terminalTheme(scheme);
  }, [scheme]);

  return (
    <div className="relative min-h-0 flex-1 px-3 pb-3">
      <div ref={host} data-testid="terminal" className="h-full" />
      {/* The note covers the terminal: no cursor shows under it. */}
      {note && (
        <div className="absolute inset-0 flex items-center bg-canvas px-4">
          <ErrorNote label="Terminal error" problem={terminalProblem(note)} detail={note} onRetry={() => again.current()} />
        </div>
      )}
    </div>
  );
}
