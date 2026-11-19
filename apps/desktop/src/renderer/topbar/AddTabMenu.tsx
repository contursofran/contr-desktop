// Adapted from ParadevAI/Paradev apps/desktop/src/renderer/routes/_authenticated/_dashboard/workspace/$workspaceId/components/AddTabMenu/AddTabMenu.tsx
// at ff9b0c7eea1d9f9cda9150fa2d9193aceae4846d.
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@ui-sdk/react/menu";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { TerminalKind } from "../../shared/api";
import { hotkey } from "../hotkeys/registry";
import { Tip } from "../ui/Tip";

const PROGRAMS = [["claude", "Claude Code"], ["codex", "Codex"], ["shell", "Shell"]] as const;

export function AddTabMenu({ onStart, starting }: { onStart: (kind: TerminalKind) => void; starting: boolean }) {
  const first = useRef<HTMLDivElement>(null);
  const afterClose = useRef<(() => void) | null>(null);
  const [launch, setLaunch] = useState<(() => void) | null>(null);
  const runAfterClose = (action: () => void) => { afterClose.current = action; };

  // Let React commit the closed menu before the launch changes the selected view.
  useEffect(() => { launch?.(); }, [launch]);

  return (
    <Menu onOpenChangeComplete={(open) => {
      if (open) {
        first.current?.focus();
        return;
      }
      const action = afterClose.current;
      afterClose.current = null;
      if (action) setLaunch(() => action);
    }}>
      <Tip label="New tab">
        <MenuTrigger
          aria-label="New tab"
          shortcut={hotkey("NEW_TERMINAL", window.contr.platform)}
          disabled={starting}
          focusableWhenDisabled
          className="flex size-[26px] shrink-0 items-center justify-center rounded-[6px] text-dim hover:bg-hover hover:text-muted focus-visible:ring-1 focus-visible:ring-foreground"
        >
          <Plus aria-hidden className="size-3.5" />
        </MenuTrigger>
      </Tip>
      <MenuContent aria-label="New tab" side="bottom" align="start" sideOffset={4} className="m-0 min-w-32 rounded-xl border border-float-line bg-raised p-1 text-foreground shadow-[var(--shadow-float)] [-webkit-app-region:no-drag]">
        {PROGRAMS.map(([kind, label], i) => (
          <MenuItem
            key={kind}
            ref={i === 0 ? first : undefined}
            value={kind}
            onSelect={() => runAfterClose(() => onStart(kind))}
            className="flex h-8 cursor-default items-center whitespace-nowrap rounded-md px-2 text-[13px] outline-none data-highlighted:bg-hover focus:bg-hover"
          >
            {label}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
