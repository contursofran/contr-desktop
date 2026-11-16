import { readFileSync, writeFileSync } from "node:fs";
import type { ThemeChoice } from "../../shared/api";

const CHOICES: ThemeChoice[] = ["system", "dark", "light"];

/** Reads the saved theme choice from the settings file. A missing or bad file gives "system". */
export function readTheme(file: string): ThemeChoice {
  try {
    const theme = (JSON.parse(readFileSync(file, "utf8")) as { theme?: unknown }).theme;
    return CHOICES.includes(theme as ThemeChoice) ? (theme as ThemeChoice) : "system";
  } catch {
    return "system";
  }
}

/** Saves the theme choice; keeps the other keys of the settings file. Rejects an unknown choice. */
export function writeTheme(file: string, theme: string): ThemeChoice {
  if (!CHOICES.includes(theme as ThemeChoice)) throw new Error(`unknown theme: ${theme}`);
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    data = {};
  }
  writeFileSync(file, JSON.stringify({ ...data, theme }, null, 2));
  return theme as ThemeChoice;
}
