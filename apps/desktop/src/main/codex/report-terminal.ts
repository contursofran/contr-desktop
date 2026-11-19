// This program runs in the coordinator's hc terminal. It records input before
// contr opens the chat, and while contr is closed.
import { randomUUID } from "node:crypto";
import { renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { reportInput } from "./report-input";

const dir = process.argv[2];
if (!dir || !process.stdin.isTTY) process.exit(1);
process.stdin.setRawMode(true);
process.stdin.setEncoding("utf8");
let sequence = 0;
process.stdin.on("data", reportInput((text) => {
  const file = join(dir, `${Date.now()}-${String(sequence++).padStart(8, "0")}-${randomUUID()}`);
  writeFileSync(file + ".tmp", text, { mode: 0o600, flag: "wx" });
  renameSync(file + ".tmp", file + ".report");
}));
process.stdout.write("\x1b[?2004hContr Codex coordinator\r\n", () => {
  writeFileSync(join(dir, "ready"), process.env.HC_TERMINAL_ID ?? "");
});
