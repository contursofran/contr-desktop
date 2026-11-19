import type { Terminal } from "@xterm/xterm";
import { clipboardShortcut } from "./clipboard-shortcuts";

export function wireTerminalClipboard(term: Terminal, isMac: boolean) {
  const isWindows = navigator.platform.startsWith("Win");
  term.attachCustomKeyEventHandler((event) => {
    if (event.type !== "keydown" || event.isComposing) return true;
    const action = clipboardShortcut(event, {
      isMac,
      isWindows,
      hasSelection: term.hasSelection(),
      appOwnsSelection: term.modes.mouseTrackingMode !== "none",
    });
    if (!action) return true;
    // Let xterm handle native copy/paste events. The alternate chords use the same paste path.
    if (action === "native") return false;
    event.preventDefault();
    if (action === "copy") {
      void navigator.clipboard.writeText(term.getSelection()).catch(() => {});
    } else {
      const textarea = term.textarea;
      void navigator.clipboard.readText().then((text) => {
        if (text && textarea?.isConnected && document.activeElement === textarea) term.paste(text);
      }).catch(() => {});
    }
    return false;
  });
}
