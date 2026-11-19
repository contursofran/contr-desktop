// Adapted from ParadevAI/Paradev apps/desktop/src/renderer/routes/_authenticated/_dashboard/workspace/$workspaceId/components/AddTabMenu/AddTabMenu.tsx
// at ff9b0c7eea1d9f9cda9150fa2d9193aceae4846d.
import { Menu, MenuContent, MenuGroup, MenuGroupLabel, MenuItem, MenuTrigger } from "@ui-sdk/react/menu";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { TerminalKind } from "../../shared/api";
import { hotkey } from "../hotkeys/registry";
import { AgentIcon } from "../ui/AgentIcon";
import { Tip } from "../ui/Tip";

const AGENTS = [
  { kind: "claude", label: "Claude Code", icon: "claude-code", key: "1" },
  { kind: "codex", label: "Codex", icon: "codex", key: "2" },
] as const;
const row = "flex h-[31px] cursor-default items-center gap-2.5 whitespace-nowrap rounded-[7px] px-[9px] text-[12.8px] outline-none data-highlighted:bg-selected focus:bg-selected";

export function AddTabMenu({ onStart, starting }: { onStart: (kind: TerminalKind) => void; starting: boolean }) {
  const first = useRef<HTMLDivElement>(null);
  const afterClose = useRef<(() => void) | null>(null);
  const [open, setOpen] = useState(false);
  const [launch, setLaunch] = useState<(() => void) | null>(null);
  const choose = (kind: TerminalKind) => { afterClose.current = () => onStart(kind); };

  // Let React commit the closed menu before the launch changes the selected view.
  useEffect(() => { launch?.(); }, [launch]);

  return (
    <Menu open={open} onOpenChange={setOpen} onOpenChangeComplete={(open) => {
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
      <MenuContent
        aria-label="New tab"
        side="bottom"
        align="start"
        sideOffset={4}
        className="m-0 w-[250px] rounded-xl border border-float-line bg-raised p-[5px] text-foreground shadow-[var(--shadow-float)] [-webkit-app-region:no-drag]"
        onKeyDownCapture={(event) => {
          if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
          const agent = AGENTS.find((item) => item.key === event.key);
          if (!agent) return;
          event.preventDefault();
          event.stopPropagation();
          choose(agent.kind);
          setOpen(false);
        }}
      >
        <MenuItem ref={first} value="shell" onSelect={() => choose("shell")} className={row}>
          <AgentIcon kind="shell" size={14} color="currentColor" />
          Terminal
        </MenuItem>
        <MenuGroup>
          <MenuGroupLabel className="px-[9px] pt-2 pb-1 text-[11px] text-dim">Start an agent</MenuGroupLabel>
          {AGENTS.map(({ kind, label, icon, key }) => (
            <MenuItem key={kind} value={kind} aria-keyshortcuts={key} onSelect={() => choose(kind)} className={row}>
              <AgentIcon kind={icon} size={14} color="currentColor" />
              <span className="flex-1">{label}</span>
              <span aria-hidden className="text-[11px] text-dim">{key}</span>
            </MenuItem>
          ))}
        </MenuGroup>
      </MenuContent>
    </Menu>
  );
}
