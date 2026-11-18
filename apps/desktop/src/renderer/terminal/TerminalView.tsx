import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";
import { useColorScheme } from "../chat/markdown/useColorScheme";
import type { Sidebar } from "../../shared/api";
import { terminalProblem } from "./problem";
import { TerminalNotice } from "./TerminalNotice";
import { terminalTheme } from "./theme";

// The design's terminal type: JetBrains Mono (`--font-mono`, bundled) 13/20.
const MONO = '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace';
const SIZE = 13;
const LINE = 20;

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
    let stop = () => undefined as void;
    let gone = false;
    // xterm measures the cell when it opens: open it when the bundled font is in, so that cols, rows and the
    // 20 px row are right before the attach. A font that does not load leaves the fallback, and the terminal opens.
    const ready = document.fonts.load(`${SIZE}px ${MONO}`).catch(() => undefined);
    void ready.then(() => {
      if (gone) return;
      stop = start(el);
    });
    return () => {
      gone = true;
      stop();
    };
  }, []);

  function start(el: HTMLDivElement) {
    const term = new Terminal({
      fontFamily: MONO,
      fontSize: SIZE,
      lineHeight: lineHeight(),
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
  }

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
    // No frame: the terminal fills the area under the tab bar, with the design's inset.
    <div className="relative min-h-0 flex-1 px-6 pt-4 pb-[18px]">
      <div ref={host} data-testid="terminal" className="h-full" />
      {note && <TerminalNotice problem={terminalProblem(note)} detail={note} onRetry={() => again.current()} />}
    </div>
  );
}

// The line height that makes a row 20 px. xterm's row is floor(ceil(font height × dpr) × lineHeight) device px, where
// the font height is the font's ascent and descent (its TextMetrics measure). The small addition keeps the floor
// from going one px under.
function lineHeight(): number {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return 1;
  ctx.font = `${SIZE}px ${MONO}`;
  const m = ctx.measureText("W");
  const dpr = window.devicePixelRatio || 1;
  const char = Math.ceil((m.fontBoundingBoxAscent + m.fontBoundingBoxDescent) * dpr);
  return char > 0 ? (LINE * dpr) / char + 1e-6 : 1;
}
