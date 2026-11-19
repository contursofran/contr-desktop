import { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { afterEach, expect, it, vi } from "vitest";
import { AppChildren, stopChildrenOnQuit } from "./children";

function quitFixture() {
  const events = new EventEmitter();
  const requestQuit = () => {
    const preventDefault = vi.fn();
    events.emit("will-quit", { preventDefault });
    return preventDefault;
  };
  const app = Object.assign(events, { quit: vi.fn(requestQuit) });
  const children = new AppChildren();
  stopChildrenOnQuit(app, children);
  const track = () => {
    const child = new ChildProcess();
    return { child: children.track(child), kill: vi.spyOn(child, "kill").mockReturnValue(true) };
  };
  return { app, children, requestQuit, track };
}

afterEach(() => vi.useRealTimers());

it("stops each live child and resumes quit when the last child closes", async () => {
  vi.useFakeTimers();
  const { app, requestQuit, track } = quitFixture();
  const finished = track();
  const first = track();
  const last = track();
  finished.child.emit("close");

  expect(requestQuit()).toHaveBeenCalledOnce();
  expect(requestQuit()).toHaveBeenCalledOnce();
  expect(finished.kill).not.toHaveBeenCalled();
  expect(first.kill).toHaveBeenCalledOnce();
  expect(last.kill).toHaveBeenCalledOnce();

  first.child.emit("close");
  await vi.advanceTimersByTimeAsync(0);
  expect(app.quit).not.toHaveBeenCalled();

  last.child.emit("close");
  await vi.runAllTimersAsync();
  expect(app.quit).toHaveBeenCalledOnce();
  expect(app.quit.mock.results[0].value).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("forces a child to stop at the quit deadline and refuses new commands", async () => {
  vi.useFakeTimers();
  const { app, children, requestQuit, track } = quitFixture();
  const stuck = track();
  requestQuit();

  const callback = vi.fn();
  expect(children.execFile(process.execPath, ["-e", ""], {}, callback)).toBeUndefined();
  await Promise.resolve();
  expect(callback).toHaveBeenCalledWith(expect.objectContaining({ message: "The app is quitting." }), "", "");

  await vi.advanceTimersByTimeAsync(249);
  expect(stuck.kill).toHaveBeenCalledOnce();
  expect(app.quit).not.toHaveBeenCalled();

  await vi.advanceTimersByTimeAsync(1);
  expect(stuck.kill).toHaveBeenLastCalledWith("SIGKILL");
  await vi.runAllTimersAsync();
  expect(app.quit).toHaveBeenCalledOnce();
});

it("resumes an empty quit on the next event loop turn", async () => {
  vi.useFakeTimers();
  const { app, requestQuit } = quitFixture();
  expect(requestQuit()).toHaveBeenCalledOnce();

  await Promise.resolve();
  expect(app.quit).not.toHaveBeenCalled();

  await vi.runAllTimersAsync();
  expect(app.quit).toHaveBeenCalledOnce();
});
