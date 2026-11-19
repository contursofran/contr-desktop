// Adapted from ParadevAI/Paradev@ff9b0c7eea1d9f9cda9150fa2d9193aceae4846d
// apps/desktop/src/renderer/lib/terminal/terminal-addons.ts (MIT)

import { WebglAddon } from "@xterm/addon-webgl";
import type { Terminal } from "@xterm/xterm";
import { createWebglCircuitBreaker } from "./webgl-circuit-breaker";

// Keep the DOM renderer after context loss, even when the view is reopened.
const circuit = createWebglCircuitBreaker();

export function loadTerminalWebgl(terminal: Terminal): () => void {
  let webglAddon: WebglAddon | null = null;
  const disposeAddon = () => {
    // xterm registers the addon before activation. Remove it even if activation throws.
    try {
      webglAddon?.dispose();
    } catch {
      // An incomplete activation can leave the addon partly initialized.
    }
    webglAddon = null;
  };

  // Wait for xterm's viewport sync after open.
  const rafId = requestAnimationFrame(() => {
    if (!circuit.isWebglAllowed()) return;

    try {
      webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        circuit.trip();
        disposeAddon();
        terminal.refresh(0, terminal.rows - 1);
      });
      terminal.loadAddon(webglAddon);
    } catch {
      disposeAddon();
    }
  });

  return () => {
    cancelAnimationFrame(rafId);
    disposeAddon();
  };
}
