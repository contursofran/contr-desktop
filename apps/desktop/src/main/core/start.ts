import { existsSync, realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { binPath } from "../helper/binPath";
import { runHelper } from "../helper/run";
import { coreOrder, parseStamp, readBundleTag, readInstalled, stampOfTag } from "./build";
import { setCore, type CurrentCore } from "./current";
import { pickCore } from "./pick";
import { coreRoot, sharedWithHerdr } from "./root";

/** The home's helper must answer `version` in this time, else the app runs the bundle. */
const PROBE_TIMEOUT_MS = 5_000;

const realpath = (p: string) => {
  try {
    return realpathSync(p);
  } catch {
    return null;
  }
};

/** True when the helper answers `version` with protocol 1. */
export async function helperStarts(helper: string): Promise<boolean> {
  const lines = await runHelper(helper, ["version"], { timeout: PROBE_TIMEOUT_MS });
  return lines[0]?.type === "header" && lines[0].protocol === 1 && !lines.some((l) => l.type === "error");
}

/**
 * Picks the core that the app runs (rule R1) before any helper or tool call. It writes nothing:
 * a root that needs an install (rows 6 to 8) runs the bundle for now, and so does a home that does not start (row 10).
 */
export async function startCore(appRoot: string, packaged: boolean, env = process.env, home = os.homedir()): Promise<CurrentCore> {
  const e2e = env.CONTR_E2E === "1";
  const found = coreRoot(env, home, existsSync, e2e, packaged);
  let core: CurrentCore = { source: "bundle", root: found?.root ?? null };
  if (found) {
    const helper = path.join(found.root, "bin", "herdr-contr-feed");
    const bundle = path.dirname(binPath("herdr-contr-feed", appRoot, undefined, env.CONTR_CORE_BUNDLE));
    const pick = pickCore({
      root: found.root,
      // An e2e run reads no folder under home: it skips the Herdr folder's real path.
      shared: sharedWithHerdr(found.root, readInstalled, e2e ? () => null : realpath, home),
      allowed: false,
      homeHelper: existsSync(helper),
      order: coreOrder(stampOfTag(readBundleTag(bundle)), parseStamp(readInstalled(found.root)?.build)),
    });
    if (pick.source === "home" && pick.action === "none" && (await helperStarts(helper))) core = { source: "home", root: found.root };
  }
  setCore(core);
  return core;
}
