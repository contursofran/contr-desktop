const OPEN = "\x1b[200~";
const CLOSE = "\x1b[201~\r";
const MAX_REPORT = 256 * 1024;

/** hc sends a bracketed paste followed by Enter. Keep newlines inside the paste. */
export function reportInput(onReport: (text: string) => void): (data: string) => void {
  let pending = "";
  let paste = false;
  return (data) => {
    pending += data;
    while (pending) {
      const delimiter = paste ? CLOSE : OPEN;
      const end = pending.indexOf(delimiter);
      if (end === -1) {
        if (!paste || pending.length > MAX_REPORT) {
          paste = false;
          pending = pending.slice(-(OPEN.length - 1));
        }
        return;
      }
      if (paste && end <= MAX_REPORT) {
        const text = pending.slice(0, end).trim();
        if (text) onReport(text);
      }
      paste = !paste;
      pending = pending.slice(end + delimiter.length);
    }
  };
}
