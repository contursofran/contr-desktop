import { vi } from "vitest";
import picture from "../e2e/fixtures/shot.png?url";

export const image = "/fixtures/shot.png";
export const gone = "/fixtures/gone.png";
export const notesFile = "/fixtures/claude-session.jsonl";

// Only Electron serves contr-image:. Keep the real fixture and force a decode error for missing files.
export const fixtureImageUrl = vi.fn((path: string) => path === image ? picture : "data:image/png;base64,AA==");
