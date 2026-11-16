import type { ITheme } from "@xterm/xterm";

/** One theme file's terminal keys: herdr-contr's herdr-app/themes, as index.css. */
interface ThemeFile {
  background: string;
  foreground: string;
  selection: string;
  cursor: string;
  ansi: string[];
}

const DARK: ThemeFile = {
  background: "#202020",
  foreground: "#dedede",
  selection: "#3a4a63",
  cursor: "#dedede",
  ansi: [
    "#2a2a2a", "#ff6961", "#30d158", "#ffd60a", "#0a84ff", "#bf5af2", "#64d2ff", "#dedede",
    "#6a6a6a", "#ff8a80", "#5ee07f", "#ffe066", "#409cff", "#d18cf5", "#8adfff", "#ffffff",
  ],
};

const LIGHT: ThemeFile = {
  background: "#ececec",
  foreground: "#1d1d1f",
  selection: "#b3d4ff",
  cursor: "#1d1d1f",
  ansi: [
    "#1d1d1f", "#d70015", "#248a3d", "#a05a00", "#0040dd", "#8944ab", "#0071a4", "#c7c7cc",
    "#6e6e73", "#ff3b30", "#34c759", "#c98500", "#007aff", "#af52de", "#32ade6", "#f5f5f7",
  ],
};

const NAMES = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"] as const;

/** The xterm.js theme for the system appearance: `ansi` 0-7 are the normal colors, 8-15 the bright ones. */
export function terminalTheme(scheme: "light" | "dark"): ITheme {
  const f = scheme === "light" ? LIGHT : DARK;
  const theme: ITheme = { background: f.background, foreground: f.foreground, cursor: f.cursor, selectionBackground: f.selection };
  const t = theme as Record<string, string>;
  NAMES.forEach((n, i) => {
    t[n] = f.ansi[i]!;
    t[`bright${n[0]!.toUpperCase()}${n.slice(1)}`] = f.ansi[i + 8]!;
  });
  return theme;
}
