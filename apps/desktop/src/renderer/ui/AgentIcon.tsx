import { Bot, Terminal } from "lucide-react";
import claude from "../sidebar/icons/claude.svg?raw";
import codex from "../sidebar/icons/codex.svg?raw";

/** The SVG text at the box's size, without its source comment and title (the icon is decorative). */
const picture = (raw: string) => raw.replace(/<!--[\s\S]*?-->|<title>[^<]*<\/title>/g, "").replace(/ (width|height)="1em"/g, ' $1="100%"');

/**
 * The program icons by hc's `agent` kind. Herdr's program table (herdr-app defaults/programs.json)
 * gives Claude Code and Codex `tint: false`, so the mod draws them as pictures in their own colors.
 */
const PICTURES: Record<string, string> = { "claude-code": picture(claude), codex: picture(codex) };

/**
 * The agent's icon, as herdr-contr's `agentIcon()`: the program's picture in its own colors,
 * else a one-color glyph (a bot, for a kind with no picture) in `color`.
 */
export function AgentIcon({ kind, size, color }: { kind: string | null | undefined; size: number; color: string }) {
  if (kind === "shell") return <Terminal aria-hidden data-icon="shell" className="shrink-0" style={{ width: size, height: size, color }} />;
  const src = kind ? PICTURES[kind] : undefined;
  if (!src) return <Bot aria-hidden data-icon="agent" className="shrink-0" style={{ width: size, height: size, color }} />;
  return <span aria-hidden data-icon={kind} className="flex shrink-0" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: src }} />;
}
