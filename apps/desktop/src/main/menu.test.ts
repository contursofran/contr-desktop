import { expect, test, vi } from "vitest";
import { fileMenu } from "./menu";

vi.mock("electron", () => ({}));

test("the File menu gives Close Tab Command+W and Close Window Shift+Command+W", () => {
  expect(fileMenu()).toEqual({
    role: "fileMenu",
    submenu: [
      { id: "close-tab", label: "Close Tab", accelerator: "Command+W", click: expect.any(Function) },
      { role: "close", label: "Close Window", accelerator: "Shift+Command+W" },
    ],
  });
});
