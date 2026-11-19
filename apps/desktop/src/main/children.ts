import { execFile, type ChildProcess, type ExecException, type ExecFileOptionsWithStringEncoding } from "node:child_process";

const QUIT_GRACE_MS = 250;

export class AppChildren {
  private readonly running = new Map<ChildProcess, Promise<void>>();
  private closing = false;

  get stopping(): boolean {
    return this.closing;
  }

  track<T extends ChildProcess>(child: T): T {
    if (this.closing) {
      child.kill("SIGKILL");
      return child;
    }
    this.running.set(child, new Promise((resolve) => {
      child.once("close", () => {
        this.running.delete(child);
        resolve();
      });
    }));
    return child;
  }

  /** Keep the command callback contract even when the app has stopped taking work. */
  execFile(
    file: string,
    args: readonly string[],
    options: ExecFileOptionsWithStringEncoding,
    callback: (error: ExecException | null, stdout: string, stderr: string) => void,
  ): ChildProcess | undefined {
    if (this.stopping) {
      const error = Object.assign(new Error("The app is quitting."), { cmd: file });
      queueMicrotask(() => callback(error, "", ""));
      return;
    }
    return this.track(execFile(file, args, options, callback));
  }

  async stop(): Promise<void> {
    this.closing = true;
    if (this.running.size === 0) return;

    for (const child of this.running.keys()) child.kill("SIGTERM");
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([
      Promise.all(this.running.values()),
      new Promise<void>((resolve) => { timer = setTimeout(resolve, QUIT_GRACE_MS); }),
    ]);
    clearTimeout(timer);
    for (const child of this.running.keys()) child.kill("SIGKILL");
  }
}

export const appChildren = new AppChildren();

interface QuitApp {
  on(event: "will-quit", listener: (event: { preventDefault(): void }) => void): unknown;
  quit(): void;
}

/** Wait after the windows close, so the renderer can detach from its terminal first. */
export function stopChildrenOnQuit(app: QuitApp, children: AppChildren): void {
  let ready = false;
  app.on("will-quit", (event) => {
    if (ready) return;
    event.preventDefault();
    if (children.stopping) return;
    void children.stop().then(() => {
      ready = true;
      // Electron clears the first quit request after its will-quit listeners return.
      setImmediate(() => app.quit());
    });
  });
}
