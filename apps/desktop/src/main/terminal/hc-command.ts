import { createInterface } from "node:readline";
import { appChildren } from "../children";

/** Sends one control request to the app's hc session. */
export function hcCommand<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const session = process.env.CONTR_HC_SESSION;
  const args = session ? ["connect", "--session", session] : ["connect"];
  return new Promise((resolve, reject) => {
    const child = appChildren.execFile(process.env.CONTR_HC ?? "hc", args, { encoding: "utf8", timeout: 10_000 }, (error, out, stderr) => {
      try {
        if (error) throw new Error(error.killed ? "no answer in 10 s" : stderr.trim() || error.message);
        let reply: { result?: T; error?: { message?: string } };
        try { reply = JSON.parse(out); }
        catch { throw new Error("hc gave no JSON"); }
        if (reply?.error) throw new Error(reply.error.message || "hc refused the request");
        if (reply?.result === undefined) throw new Error("hc gave no result");
        resolve(reply.result);
      } catch (error) {
        reject(error);
      }
    });
    if (!child?.stdin || !child.stdout) return;
    child.stdin.on("error", () => undefined);
    createInterface({ input: child.stdout }).once("line", () => child.stdin?.end());
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) + "\n");
  });
}

export async function runHcTerminal(params: Record<string, unknown>): Promise<string> {
  const { address } = await hcCommand<{ address?: unknown }>("terminal.run", params);
  if (typeof address !== "string" || !address) throw new Error("hc gave no terminal address");
  return address;
}
