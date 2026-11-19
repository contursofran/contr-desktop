import path from "node:path";
import { bundleOf } from "./install";
import { RELEASE_FILE_URL, RELEASE_URL, RELEASES_URL } from "./release";

export function updateConfig(env: NodeJS.ProcessEnv, packaged: boolean, exe: () => string) {
  const e2e = env.CONTR_E2E === "1";
  const defaults = packaged && !e2e;
  const test = e2e ? env : {};
  return {
    e2e,
    url: test.CONTR_UPDATE_URL ?? (defaults ? RELEASE_URL : null),
    file: test.CONTR_RELEASE_FILE_URL ?? (defaults ? RELEASE_FILE_URL : null),
    releases: test.CONTR_RELEASES_URL ?? (defaults ? RELEASES_URL : null),
    target: test.CONTR_INSTALL_DIR ? path.join(test.CONTR_INSTALL_DIR, "contr.app") : defaults ? bundleOf(exe()) : null,
    downloads: test.CONTR_DOWNLOADS,
  };
}
