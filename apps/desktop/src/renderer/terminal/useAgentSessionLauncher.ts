// Adapted from ParadevAI/Paradev apps/desktop/src/renderer/routes/_authenticated/_dashboard/workspace/$workspaceId/hooks/useAgentSessionLauncher/useAgentSessionLauncher.ts
// at ff9b0c7eea1d9f9cda9150fa2d9193aceae4846d.
import { useCallback, useRef, useState } from "react";
import type { TerminalKind } from "../../shared/api";

export function useAgentSessionLauncher(cwd: string | null, onStarted: (terminalId: string, kind: TerminalKind) => void) {
  const pending = useRef(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string>();

  const start = useCallback(async (kind: TerminalKind) => {
    if (pending.current) return;
    pending.current = true;
    setStarting(true);
    setStartError(undefined);
    try {
      const result = await window.contr.terminal.start?.(kind, cwd);
      if (!result) {
        setStartError("Terminal launch is unavailable");
      } else if ("error" in result) {
        setStartError(result.error);
      } else {
        const terminalId = result.terminal;
        onStarted(terminalId, kind);
      }
    } catch (error) {
      setStartError(error instanceof Error ? error.message : String(error));
    } finally {
      pending.current = false;
      setStarting(false);
    }
  }, [cwd, onStarted]);

  return { start, starting, startError };
}
