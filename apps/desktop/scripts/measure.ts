// Measures start time and memory of the production build (spike measure 4).
// Run after `pnpm build`: node scripts/measure.ts [fixture.jsonl]
// It launches through e2e/launch.ts (CONTR_E2E=1, no focus) with the fake helper.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { launchApp } from "../e2e/launch.ts";

const e2e = path.resolve(import.meta.dirname, "../e2e");
const fixture = process.argv[2] ?? path.join(e2e, "fixtures/claude-session.jsonl");
const idleMs = Number(process.env.MEASURE_IDLE_MS ?? 30_000);

/** Sums the RSS (MB) of the main process and all its child processes. */
function rssTree(root: number): { mb: number; count: number } {
  const lines = execFileSync("ps", ["-axo", "pid=,ppid=,rss="], { encoding: "utf8" }).trim().split("\n");
  const procs = lines.map((l) => l.trim().split(/\s+/).map(Number));
  const tree = new Set([root]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const [pid, ppid] of procs) if (tree.has(ppid) && !tree.has(pid)) {
        tree.add(pid);
        grew = true;
      }
  }
  const kb = procs.filter(([pid]) => tree.has(pid)).reduce((s, [, , rss]) => s + rss, 0);
  return { mb: Math.round(kb / 1024), count: tree.size };
}

const t0 = performance.now();
const app = await launchApp({
  CONTR_HELPER: path.join(e2e, "fake-helper.mjs"),
  FAKE_HELPER_FIXTURE: fixture,
  CONTR_TERMINAL: "t7",
  CONTR_HC: path.join(e2e, "fake-hc.mjs"),
});
const page = await app.firstWindow();
await page.waitForLoadState("domcontentloaded");
const tWindow = performance.now() - t0;
await page.locator("[aria-label=Chat] [role=listitem]").first().waitFor();
const tRows = performance.now() - t0;
const rows = await page.locator("[aria-label=Chat] [role=listitem]").count();
const pid = app.process().pid!;
await new Promise((r) => setTimeout(r, idleMs));
const mem = rssTree(pid);
console.log(JSON.stringify({ fixture: path.basename(fixture), windowMs: Math.round(tWindow), rowsMs: Math.round(tRows), rows, idleS: idleMs / 1000, rssMb: mem.mb, processes: mem.count }));
await app.close();
