import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";
import { useColorScheme } from "../chat/markdown/useColorScheme";
import { terminalTheme } from "./theme";

// The agent's hc terminal in xterm.js. Keys and paste go to hc; the size follows the view.
export function TerminalView() {
  const host = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState<string | null>(null);
  const shown = useRef<Terminal>(null);
  const scheme = useColorScheme();
  const first = useRef(scheme);

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
    void api.attach(term.cols, term.rows).then((r) => { if (r.error) setNote(r.error); });
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

  // The colors follow the system appearance, as the theme tokens do.
  useEffect(() => {
    if (shown.current) shown.current.options.theme = terminalTheme(scheme);
  }, [scheme]);

  return (
    <div className="relative min-h-0 flex-1 px-3 pb-3">
      <div ref={host} data-testid="terminal" className="h-full" />
      {note && <p className="absolute bottom-4 left-4 text-sm text-muted">{note}</p>}
    </div>
  );
}
