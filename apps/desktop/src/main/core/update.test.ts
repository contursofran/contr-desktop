import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CORE_CHANNEL, CORE_UPDATE_CHANNEL, type CoreState } from "../../shared/api";
import { NO_GH } from "./check";
import { registerCoreIpc } from "./ipc";
import { readUpdateDone, updateArgs } from "./update";

const { handlers, runHelper } = vi.hoisted(() => ({
  handlers: new Map<string, () => unknown>(),
  runHelper: vi.fn(),
}));
vi.mock("electron", () => ({
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: { handle: (channel: string, handler: () => unknown) => handlers.set(channel, handler) },
}));
vi.mock("../helper", () => ({ restartFeeds: vi.fn() }));
vi.mock("../helper/run", () => ({ helperPath: () => "fake-helper", runHelper }));

const root = path.resolve("scratch/contr-core");
const state = () => handlers.get(CORE_CHANNEL)!() as CoreState;
const press = async () => handlers.get(CORE_UPDATE_CHANNEL)!();
const calls = () => runHelper.mock.calls.filter(([, args]) => args[1] === "install");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  runHelper.mockReset().mockResolvedValue([{ type: "update", installed: "old", newest: "new", differs: true }]);
});
afterEach(() => {
  handlers.clear();
  vi.useRealTimers();
});

async function start() {
  const { check } = registerCoreIpc("scratch/app.asar", { source: "home", root });
  await check(false);
}

it("a herdr-contr root passes --home with its parent", () => {
  expect(updateArgs(path.join(path.dirname(root), "herdr-contr"))).toEqual(["update", "install", "--home", path.dirname(root)]);
  expect(updateArgs(root)).toEqual(["update", "install"]);
});

it("usage gives the cannot-update text", () => {
  expect(readUpdateDone([{ type: "error", code: "usage" }])).toEqual({
    error: "This core cannot update itself yet. Install a newer contr app.",
  });
});

it.each(["no-gh", "gh"])("%s uses the GitHub CLI text", (code) => {
  expect(readUpdateDone([{ type: "error", code }])).toEqual({ error: NO_GH });
});

it("reads the version when present and the stamp when it is absent", () => {
  expect(readUpdateDone([{ type: "update-done", installed: "stamp", version: "0.1.57" }])).toEqual({ installed: "stamp", version: "0.1.57" });
  expect(readUpdateDone([{ type: "update-done", installed: "stamp" }])).toEqual({ installed: "stamp", version: null });
  expect(readUpdateDone([{ type: "update-plan" }])).toHaveProperty("error");
});

it("a press with no available update starts no install", async () => {
  runHelper.mockResolvedValue([{ type: "update", installed: "old", newest: "old", differs: false }]);
  await start();
  await press();
  expect(calls()).toHaveLength(0);
});

it("a press while an update runs starts no second one", async () => {
  await start();
  runHelper.mockResolvedValue([{ type: "error", message: "fake" }]);
  const first = press();
  expect(state().installing).toBe(true);
  const second = press();
  expect(calls()).toHaveLength(1);
  await Promise.all([first, second]);
});

it("the update call has the 10 minute timeout", async () => {
  await start();
  runHelper.mockResolvedValue([{ type: "error", message: "fake" }]);
  await press();
  expect(calls()).toEqual([["fake-helper", ["update", "install"], expect.objectContaining({
    timeout: 600_000,
    env: expect.objectContaining({ CONTR_HOME: root }),
  })]]);
});
