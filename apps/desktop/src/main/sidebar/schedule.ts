/**
 * One read for a burst of refreshes: `debounceMs` after the last refresh, but no later than `maxWaitMs` after the first,
 * so a steady stream of refreshes still reads. One read at a time: a refresh during a read starts one more read after it,
 * so an older read never finishes last.
 */
export function readScheduler(read: () => Promise<void>, debounceMs: number, maxWaitMs: number): () => void {
  let timer: NodeJS.Timeout | undefined;
  let first: number | undefined;
  let reading = false;
  let again = false;
  const readNow = () => {
    if (reading) return void (again = true);
    reading = true;
    void read()
      .catch(() => undefined)
      .finally(() => {
        reading = false;
        if (again) {
          again = false;
          readNow();
        }
      });
  };
  return () => {
    clearTimeout(timer);
    first ??= Date.now();
    timer = setTimeout(() => {
      first = undefined;
      readNow();
    }, Math.max(0, Math.min(debounceMs, first + maxWaitMs - Date.now())));
  };
}

/** Splits a stream into lines: gives each full line to `onLine` and keeps a part line for the next chunk. */
export function lineSplitter(onLine: (line: string) => void): (chunk: Buffer | string) => void {
  let rest = "";
  return (chunk) => {
    const lines = (rest + chunk.toString()).split("\n");
    rest = lines.pop() ?? "";
    for (const line of lines) onLine(line);
  };
}
