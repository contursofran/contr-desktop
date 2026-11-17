import { describe, expect, it } from "vitest";
import { failText, getJson, NO_NETWORK, newer, parseRelease, parseReleaseFile, readReleaseFile } from "./release";

const asset = (name: string) => ({ name, browser_download_url: `https://x/${name}` });

describe("parseRelease", () => {
  it("reads the version from the notes and the .dmg and .zip urls", () => {
    expect(parseRelease({ name: "build-2026-11-16-abc1234", body: "contr 0.1.12 from abc.", assets: [asset("contr-mac-universal.zip"), asset("contr-mac-universal.dmg")] })).toEqual({ version: "0.1.12", dmgUrl: "https://x/contr-mac-universal.dmg", zipUrl: "https://x/contr-mac-universal.zip" });
  });
  it("falls back to the name and gives no urls with no assets", () => {
    expect(parseRelease({ name: "contr 1.2.3", assets: [] })).toEqual({ version: "1.2.3", dmgUrl: null, zipUrl: null });
  });
  it("throws with no version", () => expect(() => parseRelease({ body: "notes" })).toThrow("no version"));
});

describe("newer", () => {
  it("compares each part as a number", () => {
    expect(newer("0.1.10", "0.1.9")).toBe(true);
    expect(newer("0.1.9", "0.1.10")).toBe(false);
    expect(newer("0.1.9", "0.1.9")).toBe(false);
    expect(newer("1.0.0", "0.9.9")).toBe(true);
  });
});

const FILE = "https://github.com/o/r/releases/latest/download/release.json";
const file = { schema: 1, version: "0.1.30", tag: "build-2026-11-17-ccccccc", sha: "c", date: "2026-11-17T00:00:00Z", assets: ["contr-mac-universal.dmg", "contr-mac-universal.zip"], releases: [{ version: "0.1.30", tag: "build-2026-11-17-ccccccc", date: "2026-11-17", changes: ["A (#1)"] }, { version: "bad" }] };
const answer = (body: unknown, status = 200, headers: Record<string, string> = {}) => (async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers })) as typeof fetch;
const limit = () => ({ "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(new Date(2026, 10, 17, 14, 5, 30).getTime() / 1000) });

describe("parseReleaseFile", () => {
  it("gives the version, the asset URLs under releases/download/<tag>/ and the change log", () => {
    expect(parseReleaseFile(file, FILE)).toEqual({
      release: { version: "0.1.30", dmgUrl: "https://github.com/o/r/releases/download/build-2026-11-17-ccccccc/contr-mac-universal.dmg", zipUrl: "https://github.com/o/r/releases/download/build-2026-11-17-ccccccc/contr-mac-universal.zip" },
      releases: [file.releases[0]],
    });
  });
  it("gives no URL for an asset that the release does not have", () => expect(parseReleaseFile({ ...file, assets: [] }, FILE).release).toEqual({ version: "0.1.30", dmgUrl: null, zipUrl: null }));
  it("throws for another schema or no version", () => {
    expect(() => parseReleaseFile({ ...file, schema: 2 }, FILE)).toThrow();
    expect(() => parseReleaseFile({ ...file, version: undefined }, FILE)).toThrow();
  });
});

describe("readReleaseFile", () => {
  it("reads the file", async () => expect((await readReleaseFile(FILE, answer(file)))?.release.version).toBe("0.1.30"));
  it("gives null for HTTP 404, bad JSON or a file that is not schema 1: the caller reads the API", async () => {
    expect(await readReleaseFile(FILE, answer("", 404))).toBeNull();
    expect(await readReleaseFile(FILE, answer("{not json"))).toBeNull();
    expect(await readReleaseFile(FILE, answer({ schema: 1 }))).toBeNull();
  });
  it("throws the plain words for another failed read", async () => {
    await expect(readReleaseFile(FILE, answer("", 429, limit()))).rejects.toThrow("GitHub's limit for this network is reached. Try again after 14:05.");
    await expect(readReleaseFile(FILE, answer("", 500))).rejects.toThrow("HTTP 500");
  });
});

describe("failText and getJson", () => {
  const res = (status: number, headers: Record<string, string> = {}) => ({ status, headers: new Headers(headers) });
  it("a 403 or 429 with no requests left says the limit and the local time it ends", () => {
    expect(failText(res(403, limit()))).toBe("GitHub's limit for this network is reached. Try again after 14:05.");
    expect(failText(res(429, limit()))).toBe("GitHub's limit for this network is reached. Try again after 14:05.");
    expect(failText(res(403, { "x-ratelimit-remaining": "0" }))).toBe("GitHub's limit for this network is reached. Try again later.");
  });
  it("another failure keeps HTTP <status>", () => {
    expect(failText(res(403, { "x-ratelimit-remaining": "12" }))).toBe("HTTP 403");
    expect(failText(res(500, limit()))).toBe("HTTP 500");
  });
  it("no answer at all says there is no network", async () => {
    const down = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    await expect(getJson("https://x", down)).rejects.toThrow(NO_NETWORK);
    await expect(readReleaseFile(FILE, down)).rejects.toThrow(NO_NETWORK);
  });
});
