import { existsSync, realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { binPath } from "../helper/binPath";
import { runHelper } from "../helper/run";
import { coreOrder, parseStamp, readBundleTag, readInstalled, stampOfTag } from "./build";
import { setCore, type CurrentCore } from "./current";
import { installCore } from "./install";
import { pickCore } from "./pick";
import { coreRoot, herdrRoot, sharedWithHerdr } from "./root";

/** The home's helper must answer `version` in this time, else the app runs the bundle. */
const PROBE_TIMEOUT_MS = 5_000;

/** T8: the home's helper does not start, or has another protocol (row 10). */
export const CORE_NOT_START = "The core in this folder does not start. contr runs its own copy.";
/** T9: the start install failed. */
export const coreInstallFailed = (message: string) => `Core install failed: ${message}`;

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
 * True when an install would make `~/.config/contr-core` while an older root folder exists: that new folder would
 * change the default root of the Herdr mod, the tool and each agent. The app never installs there then.
 */
export function wouldHideOldRoot(root: string, home: string, exists: (dir: string) => boolean): boolean {
  const config = path.join(home, ".config");
  return path.resolve(root) === path.join(config, "contr-core") && (exists(path.join(config, "contr-backend")) || exists(herdrRoot(home)));
}

/**
 * Picks the core that the app runs (rule R1) before any helper or tool call. A root that is not shared and has no
 * helper or an older one (rows 6 to 8) gets the bundle's core first. A failed install, or a home that does not start
 * (row 10), runs the bundle and keeps the reason in `error`.
 */
export async function startCore(
  appRoot: string,
  packaged: boolean,
  env = process.env,
  home = os.homedir(),
  install = installCore,
): Promise<CurrentCore> {
  const e2e = env.CONTR_E2E === "1";
  const found = coreRoot(env, home, existsSync, e2e, packaged);
  let core: CurrentCore = { source: "bundle", root: found?.root ?? null, error: null };
  if (found) {
    const helper = path.join(found.root, "bin", "herdr-contr-feed");
    const bundleHelper = binPath("herdr-contr-feed", appRoot, undefined, env.CONTR_CORE_BUNDLE);
    const bundle = path.dirname(bundleHelper);
    const pick = pickCore({
      root: found.root,
      // An e2e run reads no folder under home: it skips the Herdr folder's real path.
      shared: sharedWithHerdr(found.root, readInstalled, e2e ? () => null : realpath, home),
      allowed: false,
      homeHelper: existsSync(helper),
      order: coreOrder(stampOfTag(readBundleTag(bundle)), parseStamp(readInstalled(found.root)?.build)),
    });
    let ready = pick.source === "home" && pick.action === "none";
    if (pick.action === "install" && !wouldHideOldRoot(found.root, home, existsSync)) {
      const orch = path.join(bundle, "herdr-contr-orch");
      const done = await install(bundleHelper, existsSync(orch) ? orch : null, found.root);
      if (done.ok) ready = true;
      else core = { ...core, error: coreInstallFailed(done.message) };
    }
    if (ready) core = (await helperStarts(helper)) ? { source: "home", root: found.root, error: null } : { ...core, error: CORE_NOT_START };
  }
  setCore(core);
  return core;
}
