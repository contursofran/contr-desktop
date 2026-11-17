import { describe, expect, it } from "vitest";
import { CHANGELOG_COUNT, changeLogSource, parseChangeLog, parseChanges } from "./changelog";

const SIGN = "The macOS app is ad-hoc signed, with no certificate. The first time, open it with right-click > Open\n(or run `xattr -dr com.apple.quarantine /Applications/contr.app`).";
const body = (version: string, changes: string[] = []) => [`contr ${version} from abc.`, "", ...(changes.length ? ["## Changes", "", ...changes.map((c) => `- ${c}`), ""] : []), SIGN].join("\n");
const raw = (version: string, at: string, changes: string[] = []) => ({ tag_name: `build-${at.slice(0, 10)}-${version}`, published_at: at, body: body(version, changes) });

describe("parseChanges", () => {
  it("reads the lines of the Changes part and stops at the signature lines", () => {
    expect(parseChanges(body("0.1.2", ["B (#2)", "A (#1)"]))).toEqual(["B (#2)", "A (#1)"]);
  });
  it("stops at the first line that is not a change", () => {
    expect(parseChanges("contr 0.1.2 from abc.\n\n## Changes\n\n- A (#1)\n\n## Other\n\n- not a change\n")).toEqual(["A (#1)"]);
  });
  it("reads CRLF notes", () => expect(parseChanges(body("0.1.2", ["A (#1)"]).replaceAll("\n", "\r\n"))).toEqual(["A (#1)"]));
  it("gives no lines with no Changes part", () => expect(parseChanges(body("0.1.2"))).toEqual([]));
});

describe("parseChangeLog", () => {
  it("sorts by published_at, newest first, and gives version, tag, date and changes", () => {
    const list = parseChangeLog([raw("0.1.2", "2026-11-16T10:00:00Z"), raw("0.1.3", "2026-11-17T01:00:00Z", ["C (#3)"])]);
    expect(list).toEqual([
      { version: "0.1.3", tag: "build-2026-11-17-0.1.3", date: "2026-11-17", changes: ["C (#3)"] },
      { version: "0.1.2", tag: "build-2026-11-16-0.1.2", date: "2026-11-16", changes: [] },
    ]);
  });
  it("keeps the newest 10 and leaves out drafts and releases with no version", () => {
    const many = Array.from({ length: 12 }, (_, i) => raw(`0.1.${i}`, `2026-11-${String(i + 1).padStart(2, "0")}T00:00:00Z`));
    const list = parseChangeLog([{ ...raw("0.2.0", "2026-12-01T00:00:00Z"), draft: true }, { tag_name: "x", body: "notes", published_at: "2026-12-02T00:00:00Z" }, ...many]);
    expect(list).toHaveLength(CHANGELOG_COUNT);
    expect(list[0].version).toBe("0.1.11");
    expect(list.at(-1)?.version).toBe("0.1.2");
  });
  it("gives an empty list for an answer that is not a list", () => expect(parseChangeLog({ message: "rate limit" })).toEqual([]));
});

/** A fake fetch: answers each call with the next of `answers` (a JSON body, or a status number). Counts the calls. */
function fakeFetch(...answers: (unknown | number)[]) {
  const calls: string[] = [];
  const get = (async (url: string) => {
    calls.push(url);
    const a = answers.shift();
    return typeof a === "number" ? new Response("", { status: a }) : Response.json(a);
  }) as typeof fetch;
  return { get, calls };
}

describe("changeLogSource", () => {
  it("with no URL reads nothing and gives no releases", async () => {
    const { get, calls } = fakeFetch();
    const log = changeLogSource(null, get);
    expect(await log.get()).toEqual({ releases: null, error: null });
    expect(await log.load()).toEqual({ releases: null, error: null });
    expect(calls).toEqual([]);
  });
  it("reads once on the first get, then keeps the result in memory until a load or again", async () => {
    const { get, calls } = fakeFetch([raw("0.1.1", "2026-11-16T00:00:00Z")], [raw("0.1.2", "2026-11-17T00:00:00Z")], [raw("0.1.3", "2026-11-18T00:00:00Z")]);
    const log = changeLogSource("https://x/releases", get);
    expect((await log.get()).releases?.[0].version).toBe("0.1.1");
    expect((await log.get()).releases?.[0].version).toBe("0.1.1");
    expect(calls).toHaveLength(1);
    void log.load();
    expect((await log.get()).releases?.[0].version).toBe("0.1.2");
    expect((await log.get(true)).releases?.[0].version).toBe("0.1.3");
    expect(calls).toEqual(["https://x/releases", "https://x/releases", "https://x/releases"]);
  });
  it("runs one read at a time", async () => {
    const { get, calls } = fakeFetch([raw("0.1.1", "2026-11-16T00:00:00Z")]);
    const log = changeLogSource("https://x/releases", get);
    await Promise.all([log.load(), log.load(), log.get(true)]);
    expect(calls).toHaveLength(1);
  });
  it("a failed read gives the error and keeps the releases of the last good read", async () => {
    const { get } = fakeFetch(500, [raw("0.1.1", "2026-11-16T00:00:00Z")], 503);
    const log = changeLogSource("https://x/releases", get);
    expect(await log.get()).toEqual({ releases: null, error: "Could not load the change log: HTTP 500" });
    expect((await log.get(true)).error).toBeNull();
    const failed = await log.get(true);
    expect(failed.error).toBe("Could not load the change log: HTTP 503");
    expect(failed.releases?.[0].version).toBe("0.1.1");
  });
  const fileJson = { schema: 1, version: "0.1.30", tag: "build-x", assets: [], releases: [{ version: "0.1.30", tag: "build-x", date: "2026-11-17", changes: ["A (#1)"] }] };
  it("reads release.json first and does not read the API list when it is there", async () => {
    const { get, calls } = fakeFetch(fileJson);
    const log = changeLogSource("https://x/releases", get, "https://x/latest/download/release.json");
    expect(await log.get()).toEqual({ releases: fileJson.releases, error: null });
    expect(calls).toEqual(["https://x/latest/download/release.json"]);
  });
  it("reads the API list when release.json is not there (HTTP 404)", async () => {
    const { get, calls } = fakeFetch(404, [raw("0.1.1", "2026-11-16T00:00:00Z")]);
    const log = changeLogSource("https://x/releases", get, "https://x/latest/download/release.json");
    expect((await log.get()).releases?.[0].version).toBe("0.1.1");
    expect(calls).toEqual(["https://x/latest/download/release.json", "https://x/releases"]);
  });
  it("put gives the releases of an update check's read, with no read of its own", async () => {
    const { get, calls } = fakeFetch();
    const log = changeLogSource("https://x/releases", get, "https://x/latest/download/release.json");
    log.put(fileJson.releases);
    expect(await log.get()).toEqual({ releases: fileJson.releases, error: null });
    expect(calls).toEqual([]);
  });
  it("a rate limit gives the plain words", async () => {
    const get = (async () => new Response("", { status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(new Date(2026, 10, 17, 9, 7).getTime() / 1000) } })) as typeof fetch;
    expect((await changeLogSource("https://x/releases", get).get()).error).toBe("Could not load the change log: GitHub's limit for this network is reached. Try again after 09:07.");
  });
});
