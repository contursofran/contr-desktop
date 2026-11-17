/** Why the terminal is not shown, in plain words, from the raw reason that main/terminal/hc-attach.ts gives. */
export function terminalProblem(reason: string): string {
  if (reason.includes("ENOENT")) return "hc is not installed, or it is not on the PATH.";
  if (/no terminal/i.test(reason)) return "This terminal is not in hc. It may have closed.";
  if (reason === "the terminal stream ended") return "The terminal ended.";
  if (reason.startsWith("hc closed the connection")) return "The connection to hc ended.";
  return "The terminal could not attach to hc.";
}
