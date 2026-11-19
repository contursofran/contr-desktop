export function codexThreadId(tab: string): string | undefined {
  return /^codex:([a-z0-9_-]{1,100})$/i.exec(tab)?.[1];
}

export const CODEX_ORCHESTRATE_COMMAND = "/contr:orchestrate ";
