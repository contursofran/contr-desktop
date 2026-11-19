// Adapted from ParadevAI/Paradev apps/desktop/src/renderer/hotkeys/registry.ts
// at ff9b0c7eea1d9f9cda9150fa2d9193aceae4846d.

type Platform = "darwin" | "win32" | "linux";

export const HOTKEYS_REGISTRY = {
  NEW_TERMINAL: {
    key: { darwin: "meta+t", win32: null, linux: null },
  },
  TOGGLE_CHAT_TERMINAL: {
    key: { darwin: "meta+j", win32: null, linux: null },
  },
  PREVIOUS_AGENT: {
    key: { darwin: "meta+alt+arrowup", win32: null, linux: null },
  },
  NEXT_AGENT: {
    key: { darwin: "meta+alt+arrowdown", win32: null, linux: null },
  },
  CLOSE_TAB: {
    key: { darwin: "meta+w", win32: null, linux: null },
    accelerator: "Command+W",
  },
} as const satisfies Record<string, { key: Record<Platform, string | null>; accelerator?: string }>;

type HotkeyId = keyof typeof HOTKEYS_REGISTRY;

export function hotkey(id: HotkeyId, platform: string): string | undefined {
  if (platform === "darwin" || platform === "win32" || platform === "linux") {
    return HOTKEYS_REGISTRY[id].key[platform] ?? undefined;
  }
}

// Adapted from pingdotgg/t3code packages/shared/src/keybindingMatching.ts
// at 5b265f8eb7db05df055b2e882d4c10d332076d6b. Use the registry's chord strings.
type ShortcutEvent = Pick<KeyboardEvent,
  "key" | "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "defaultPrevented" | "isComposing" | "repeat"
>;

export function resolveHotkey(event: ShortcutEvent, platform: string): HotkeyId | undefined {
  if (event.defaultPrevented || event.isComposing || event.repeat) return;
  const layoutKey = event.key.toLowerCase();
  const letterCode = event.code.match(/^Key([A-Z])$/)?.[1];
  const key = letterCode && !/^[a-z]$/.test(layoutKey) ? letterCode.toLowerCase() : layoutKey;
  const chord = [
    event.metaKey && "meta",
    event.ctrlKey && "ctrl",
    event.altKey && "alt",
    event.shiftKey && "shift",
    key,
  ].filter(Boolean).join("+");
  return (Object.keys(HOTKEYS_REGISTRY) as HotkeyId[]).find((id) => hotkey(id, platform) === chord);
}
