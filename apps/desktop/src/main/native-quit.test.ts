import { spawn } from "node:child_process";
import { once } from "node:events";
import { expect, it } from "vitest";

it.skipIf(process.platform !== "darwin")("ends a process that stalls after it arms the quit deadline", async () => {
  const moduleUrl = new URL("./native-quit.ts", import.meta.url);
  const parent = spawn(process.execPath, ["--input-type=module", "-e", `
    import { armNativeQuitDeadline } from ${JSON.stringify(moduleUrl.href)};
    armNativeQuitDeadline();
    setTimeout(() => {}, 3500);
  `], { stdio: "ignore" });
  try {
    expect(await once(parent, "exit")).toEqual([null, "SIGKILL"]);
  } finally {
    parent.kill();
  }
});
