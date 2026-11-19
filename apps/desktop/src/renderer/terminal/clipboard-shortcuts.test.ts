// Adapted from ParadevAI/Paradev apps/desktop/src/renderer/lib/terminal/clipboard-shortcuts.test.ts
// at ff9b0c7eea1d9f9cda9150fa2d9193aceae4846d. Use Vitest and contr's routing actions.
import { expect, it } from "vitest";
import { clipboardShortcut } from "./clipboard-shortcuts";

const mac = { isMac: true, isWindows: false, hasSelection: false, appOwnsSelection: false };
const linux = { ...mac, isMac: false };
const windows = { ...linux, isWindows: true };
const key = { code: "KeyC", metaKey: false, ctrlKey: false, altKey: false, shiftKey: false };

it.each([
  ["Mac Cmd+C with selection", { metaKey: true }, { ...mac, hasSelection: true }, "native"],
  ["Mac Cmd+C without selection", { metaKey: true }, mac, "native"],
  ["Mac Cmd+C with an app selection", { metaKey: true }, { ...mac, appOwnsSelection: true }, undefined],
  ["Mac Cmd+V", { code: "KeyV", metaKey: true }, mac, "native"],
  ["Linux Ctrl+C without selection", { ctrlKey: true }, linux, undefined],
  ["Linux Ctrl+C with selection", { ctrlKey: true }, { ...linux, hasSelection: true }, "native"],
  ["Linux Ctrl+Shift+C with selection", { ctrlKey: true, shiftKey: true }, { ...linux, hasSelection: true }, "copy"],
  ["Linux Ctrl+Shift+C without selection", { ctrlKey: true, shiftKey: true }, linux, "native"],
  ["Linux Ctrl+Shift+V", { code: "KeyV", ctrlKey: true, shiftKey: true }, linux, "paste"],
  ["Linux Shift+Insert", { code: "Insert", shiftKey: true }, linux, "native"],
  ["Linux Ctrl+V", { code: "KeyV", ctrlKey: true }, linux, undefined],
  ["Windows Ctrl+V", { code: "KeyV", ctrlKey: true }, windows, "native"],
  ["Windows Ctrl+Shift+V", { code: "KeyV", ctrlKey: true, shiftKey: true }, windows, "paste"],
  ["Windows Ctrl+Alt+V", { code: "KeyV", ctrlKey: true, altKey: true }, windows, undefined],
] as const)("%s", (_name, chord, options, action) => {
  expect(clipboardShortcut({ ...key, ...chord }, options)).toBe(action);
});
