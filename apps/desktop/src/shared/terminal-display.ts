/** Default terminal colors in the format hc uses to answer display queries. */
export interface TerminalDisplay {
  bg: string;
  fg: string;
  cursor: string;
}

// From tokens.css: --win, --terminal-text mixed over --win, and --ink-95.
const light: TerminalDisplay = { bg: "#eff0f2", fg: "#2c2c2d", cursor: "#1e1e1e" };
const dark: TerminalDisplay = { bg: "#141518", fg: "#d5d5d5", cursor: "#e9e9ea" };

export function terminalDisplay(scheme: "light" | "dark"): TerminalDisplay {
  return scheme === "light" ? light : dark;
}
