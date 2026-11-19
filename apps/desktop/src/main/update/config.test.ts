import { describe, expect, it } from "vitest";
import { updateConfig } from "./config";
import { RELEASE_FILE_URL, RELEASE_URL, RELEASES_URL } from "./release";

const switches = {
  CONTR_UPDATE_URL: "http://localhost/latest",
  CONTR_RELEASE_FILE_URL: "http://localhost/release.json",
  CONTR_RELEASES_URL: "http://localhost/releases",
  CONTR_INSTALL_DIR: "/scratch/install",
  CONTR_DOWNLOADS: "/scratch/downloads",
};
const exe = () => "/Applications/contr.app/Contents/MacOS/contr";

describe("update test switches", () => {
  it("uses the packaged defaults when CONTR_E2E is absent or differs from 1", () => {
    for (const CONTR_E2E of [undefined, "true", "0"]) {
      expect(updateConfig({ ...switches, CONTR_E2E }, true, exe)).toEqual({
        e2e: false, url: RELEASE_URL, file: RELEASE_FILE_URL, releases: RELEASES_URL,
        target: "/Applications/contr.app", downloads: undefined,
      });
    }
  });

  it("ignores the switches in an ordinary development run", () => {
    expect(updateConfig(switches, false, exe)).toEqual({
      e2e: false, url: null, file: null, releases: null, target: null, downloads: undefined,
    });
  });

  it("uses the switches when CONTR_E2E is 1", () => {
    expect(updateConfig({ ...switches, CONTR_E2E: "1" }, false, exe)).toEqual({
      e2e: true, url: switches.CONTR_UPDATE_URL, file: switches.CONTR_RELEASE_FILE_URL, releases: switches.CONTR_RELEASES_URL,
      target: "/scratch/install/contr.app", downloads: switches.CONTR_DOWNLOADS,
    });
  });
});
