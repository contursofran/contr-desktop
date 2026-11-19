// Adapted from ParadevAI/Paradev apps/desktop/src/renderer/lib/terminal/clipboard-shortcuts.ts
// at ff9b0c7eea1d9f9cda9150fa2d9193aceae4846d and generalaction/emdash
// apps/emdash-desktop/src/core/features/terminals/browser/pty/pty-keybindings.ts
// at 9e2942b8281b17703c0e66845080a556ae262677. Keep only the clipboard chords.

type ClipboardKey = Pick<KeyboardEvent, "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">;

export function clipboardShortcut(
  event: ClipboardKey,
  { isMac, isWindows, hasSelection, appOwnsSelection }: {
    isMac: boolean;
    isWindows: boolean;
    hasSelection: boolean;
    appOwnsSelection: boolean;
  },
): "native" | "copy" | "paste" | undefined {
  const onlyCtrl = event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
  const ctrlShiftOnly = event.ctrlKey && event.shiftKey && !event.metaKey && !event.altKey;
  const onlyShift = event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;
  const onlyMeta = event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;

  if (isMac) {
    if (event.code === "KeyC" && onlyMeta) {
      return !hasSelection && appOwnsSelection ? undefined : "native";
    }
    if (event.code === "KeyV" && onlyMeta) return "native";
    return undefined;
  }

  if (event.code === "KeyC") {
    if (ctrlShiftOnly) return hasSelection ? "copy" : "native";
    if (onlyCtrl && hasSelection) return "native";
  }
  if (event.code === "KeyV") {
    if (ctrlShiftOnly) return "paste";
    if (isWindows && onlyCtrl) return "native";
  }
  if (!isWindows && event.code === "Insert" && onlyShift) return "native";
  return undefined;
}
