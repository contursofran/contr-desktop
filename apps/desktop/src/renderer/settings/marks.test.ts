import { expect, it } from "vitest";
import { markOf } from "./marks";

it("marks the installed version Installed, a newer one New, an older one nothing", () => {
  expect(markOf("0.1.24", "0.1.24")).toBe("Installed");
  expect(markOf("0.1.25", "0.1.24")).toBe("New");
  expect(markOf("0.1.23", "0.1.24")).toBeNull();
  expect(markOf("0.1.25", undefined)).toBeNull();
});
