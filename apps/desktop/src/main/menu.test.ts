import { expect, test, vi } from "vitest";
import { fileMenu } from "./menu";

vi.mock("electron", () => ({}));

test("the native File menu owns Command+W for Close Tab and Shift+Command+W for Close Window", () => {
  const menu = fileMenu();
  expect(menu).toEqual({
    role: "fileMenu",
    submenu: [
      { id: "close-tab", label: "Close Tab", accelerator: "Command+W", click: expect.any(Function) },
      { role: "close", label: "Close Window", accelerator: "Shift+Command+W" },
    ],
  });
  expect(menu).not.toHaveProperty("submenu.0.registerAccelerator", false);
});
