// Adapted from ParadevAI/Paradev apps/desktop/src/renderer/hotkeys/registry.ts
// at ff9b0c7eea1d9f9cda9150fa2d9193aceae4846d.

type Platform = "darwin" | "win32" | "linux";

export const HOTKEYS_REGISTRY = {
  NEW_TERMINAL: {
    key: { darwin: "meta+t", win32: null, linux: null },
  },
} as const satisfies Record<string, { key: Record<Platform, string | null> }>;

type HotkeyId = keyof typeof HOTKEYS_REGISTRY;

export function hotkey(id: HotkeyId, platform: string): string | undefined {
  if (platform === "darwin" || platform === "win32" || platform === "linux") {
    return HOTKEYS_REGISTRY[id].key[platform] ?? undefined;
  }
}
