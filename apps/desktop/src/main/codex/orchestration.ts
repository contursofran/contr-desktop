import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { app } from "electron";
import { orchPath } from "../board/board";
import { appChildren } from "../children";

interface Request {
  id?: string | number;
  method: string;
  params?: { name?: string; arguments?: Record<string, unknown> };
}
interface Tool {
  name: string;
  description: string;
  inputSchema: object;
}
interface Reply {
  jsonrpc: "2.0";
  id: Request["id"];
  result?: { tools?: Tool[]; content?: { type: string; text: string }[]; isError?: boolean };
  error?: { code: number; message: string };
}
interface Target {
  cwd: string;
  parent: () => Promise<string>;
}

const FLOW: Tool = {
  name: "flow",
  description: "Read the owner's contr workflow and limits. Call this before you start workers.",
  inputSchema: { type: "object", properties: {} },
};
const TOOLS = new Set([FLOW.name, "spawn", "list", "set_title", "message", "interrupt", "stop", "read", "prompt", "clear_ended"]);
interface Endpoint {
  target?: Target;
  pending: Promise<unknown>;
}
const endpoints = new Map<string, Endpoint>();
let listener: Promise<number> | undefined;

function orch(args: string[], cwd: string, parent?: string, input?: string): Promise<string> {
  const env: NodeJS.ProcessEnv = { ...process.env, HC_TERMINAL_ID: parent, CONTR_COORDINATOR: undefined };
  if (process.env.CONTR_HC_SESSION) env.HC_SESSION = process.env.CONTR_HC_SESSION;
  return new Promise((resolve, reject) => {
    const child = appChildren.execFile(orchPath(app.getAppPath()), args, {
      cwd, env, encoding: "utf8", timeout: parent ? 45_000 : 15_000, maxBuffer: 2 * 1024 * 1024,
    }, (error, out, stderr) => error ? reject(new Error(stderr.trim() || error.message)) : resolve(out));
    child?.stdin?.on("error", () => undefined);
    child?.stdin?.end(input);
  });
}

async function run(request: Request, target?: Target): Promise<Reply> {
  const reply = { jsonrpc: "2.0" as const, id: request.id };
  try {
    let parent: string | undefined;
    const tool = request.params?.name;
    if (request.method === "tools/call") {
      if (!tool || !TOOLS.has(tool)) throw new Error("This tool is unavailable in Codex Chat.");
      if (!target) throw new Error("Send /contr:orchestrate with a goal to start this chat's coordinator.");
      parent = await target.parent();
      if (tool === FLOW.name) {
        const text = await orch(["agents", "flow"], target.cwd, parent);
        return { ...reply, result: { content: [{ type: "text", text }] } };
      }
      const args = request.params?.arguments ?? {};
      if (tool === "spawn") {
        request.params!.arguments = { worktree: target.cwd, ...args };
      } else if (tool !== "clear_ended" && tool !== "list") {
        const all = JSON.parse(await orch(["agents", "ls", "--all", "--json"], target.cwd, parent)) as { name: string; address: string; parent: string }[];
        const workers = all.filter((w) => w.parent === parent);
        const worker = workers.find((w) => w.address === args.name) ?? workers.find((w) => w.name === args.name);
        if (!worker) throw new Error("Choose a worker started by this chat.");
        request.params!.arguments = { ...args, name: worker.address };
      }
    }
    const result: Reply = JSON.parse(await orch(["mcp"], target?.cwd ?? app.getPath("home"), parent, JSON.stringify(request) + "\n"));
    if (result.result?.tools) result.result.tools = [FLOW, ...result.result.tools.filter((t) => TOOLS.has(t.name))];
    if (tool === "list" && !result.result?.isError) {
      const content = result.result?.content?.[0];
      if (content) content.text = JSON.stringify(JSON.parse(content.text).filter((w: { parent: string }) => w.parent === parent), null, 2);
    }
    return result;
  } catch (error) {
    const message = (error as Error).message;
    return request.method === "tools/call"
      ? { ...reply, result: { isError: true, content: [{ type: "text", text: message }] } }
      : { ...reply, error: { code: -32603, message } };
  }
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const token = req.url?.slice(1);
  const port = (req.socket.localPort ?? 0).toString();
  const endpoint = token ? endpoints.get(token) : undefined;
  if (!endpoint || req.headers.host !== "127.0.0.1:" + port || req.headers.origin) {
    res.writeHead(404).end();
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405, { Allow: "POST" }).end();
    return;
  }
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 1024 * 1024) { res.writeHead(413).end(); return; }
      chunks.push(chunk);
    }
    const request = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Request;
    if (request.id === undefined) { res.writeHead(202).end(); return; }
    // Keep tool calls ordered so concurrent spawns observe the flow's worker limit.
    const result = request.method === "tools/call"
      ? endpoint.pending = endpoint.pending.then(() => run(request, endpoint.target))
      : run(request);
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(await result));
  } catch {
    res.writeHead(400).end();
  }
}

export async function openOrchestration() {
  listener ??= new Promise<number>((resolve, reject) => {
    const server = createServer((req, res) => void handle(req, res));
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") { reject(new Error("MCP server has no port.")); return; }
      server.unref();
      resolve(address.port);
    });
  }).catch((error: unknown) => { listener = undefined; throw error; });
  const port = await listener;
  const token = randomUUID();
  const endpoint: Endpoint = { pending: Promise.resolve() };
  endpoints.set(token, endpoint);
  return {
    config: { mcp_servers: { contr_workers: { url: `http://127.0.0.1:${port}/${token}`, startup_timeout_sec: 20 } } },
    enable: (target: Target) => { endpoint.target = target; },
    close: () => {
      endpoint.target = undefined;
      endpoints.delete(token);
    },
  };
}
