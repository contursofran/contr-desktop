import type { ThemeChoice } from "../../shared/api";
import { readSettings, writeSetting } from "./file";

const CHOICES: ThemeChoice[] = ["system", "dark", "light"];

/** Reads the saved theme choice from the settings file. A missing or bad file gives "system". */
export function readTheme(file: string): ThemeChoice {
  const theme = readSettings(file).theme as ThemeChoice;
  return CHOICES.includes(theme) ? theme : "system";
}

/** Saves the theme choice; keeps the other keys of the settings file. Rejects an unknown choice. */
export function writeTheme(file: string, theme: string): ThemeChoice {
  if (!CHOICES.includes(theme as ThemeChoice)) throw new Error(`unknown theme: ${theme}`);
  writeSetting(file, "theme", theme);
  return theme as ThemeChoice;
}
