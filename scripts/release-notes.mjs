#!/usr/bin/env node
// Writes the notes of a release to stdout (release.yml, job publish, step Notes).
// The first line gives the version, as the update check reads it. Then a "## Changes" part: the subject of each
// commit after the release before this one, up to this release's commit, newest first. No release before: the
// last 20 subjects. Then the lines about the ad-hoc signature (docs/reference/releases.md).
// It reads the releases and the commits with the GitHub API (gh api), so the job needs no git history.
// With --json <file> it also writes release.json, the release asset that the app's update check reads
// (docs/reference/releases.md): this release, its asset names (the files in --assets <folder>) and the change log of
// the newest RELEASE_COUNT releases. Pass the ZIP's hash with --sha256 when it is in the assets folder.
//
//   node scripts/release-notes.mjs --version 0.1.30 --sha <sha> [--tag <this tag>] [--repo owner/name] [--json <file> --assets <folder>]
//   node scripts/release-notes.mjs --dry-run     # CI on a pull request: version 0.0.0, sha $SHA or $GITHUB_SHA
import { execFileSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** With no release before, the notes list this many commits. */
export const FIRST_COUNT = 20;
/** release.json holds the change log of this many releases (Settings > Change log shows them). */
export const RELEASE_COUNT = 10;

/** The text of the notes. `changes` are commit subjects, newest first; with none there is no "## Changes" part. */
export function notesText(version, sha, changes) {
  return [
    `contr ${version} from ${sha}.`,
    "",
    ...(changes.length ? ["## Changes", "", ...changes.map((s) => `- ${s}`), ""] : []),
    "The macOS app is ad-hoc signed, with no certificate. The first time, open it with right-click > Open",
    "(or run `xattr -dr com.apple.quarantine /Applications/contr.app`).",
    "",
  ].join("\n");
}

/**
 * The tag of the newest published `build-*` release that is not `own`. The API lists releases by tag name, not
 * by time (the short sha sorts the releases of one day), so this sorts them by `published_at`.
 */
export function previousTag(releases, own) {
  const time = (r) => Date.parse(r.published_at ?? "") || 0;
  return [...releases].sort((a, b) => time(b) - time(a)).find((r) => typeof r.tag_name === "string" && r.tag_name.startsWith("build-") && r.tag_name !== own)?.tag_name ?? null;
}

/** The first line of each commit message, newest first. The compare API lists the oldest first. */
export function subjects(commits, newestFirst) {
  const list = commits.map((c) => String(c.commit?.message ?? "").split("\n")[0].trim()).filter(Boolean);
  return newestFirst ? list : list.reverse();
}

/** Gathers the subjects for `sha` after the newest of `releases`; `api(path)` returns the parsed JSON of a GitHub API path. */
export function changesFor(api, repo, sha, own, releases) {
  const before = previousTag(releases, own);
  if (!before) return subjects(api(`repos/${repo}/commits?sha=${sha}&per_page=${FIRST_COUNT}`), true);
  return subjects(api(`repos/${repo}/compare/${before}...${sha}`).commits ?? [], false);
}

/** The version in the notes, "contr 0.1.<run> from <sha>.", else in the name (as the app's `versionOf`). */
export function versionOf(r) {
  return /contr (\d+\.\d+\.\d+)/.exec(`${typeof r?.body === "string" ? r.body : ""} ${typeof r?.name === "string" ? r.name : ""}`)?.[1] ?? null;
}

/** The "- " lines of the notes' "## Changes" part, up to the first other line (as the app's `parseChanges`). */
export function changesOf(body) {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === "## Changes");
  const changes = [];
  for (const line of start < 0 ? [] : lines.slice(start + 1)) {
    if (line.trim() === "" && changes.length === 0) continue;
    if (!line.startsWith("- ")) break;
    changes.push(line.slice(2).trim());
  }
  return changes;
}

/**
 * The content of release.json. `releases` is the API's list; with this release first, it keeps the newest
 * published ones by `published_at` that have a version and are not `tag`, as the app's `parseChangeLog` does.
 */
export function releaseFile({ version, tag, sha, date, assets, sha256, changes }, releases) {
  const time = (r) => Date.parse(r.published_at ?? "") || 0;
  const older = releases
    .filter((r) => r && r.draft !== true && r.tag_name !== tag && versionOf(r) !== null)
    .sort((a, b) => time(b) - time(a))
    .slice(0, RELEASE_COUNT - 1)
    .map((r) => ({ version: versionOf(r), tag: String(r.tag_name ?? ""), date: String(r.published_at ?? "").slice(0, 10), changes: changesOf(String(r.body ?? "")) }));
  return { schema: 1, version, tag, sha, date, assets, ...(sha256 ? { sha256 } : {}), releases: [{ version, tag, date: date.slice(0, 10), changes }, ...older] };
}

function arg(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

/** Returns the notes and the content of release.json. `now` is the release's time, `assets` its file names. */
export function release(argv, env, api, now = new Date(), assets = []) {
  const dry = argv.includes("--dry-run");
  const repo = arg(argv, "--repo") ?? env.GITHUB_REPOSITORY ?? "contursofran/contr-desktop";
  const sha = arg(argv, "--sha") ?? (dry ? (env.SHA || env.GITHUB_SHA) : undefined);
  const version = arg(argv, "--version") ?? (dry ? "0.0.0" : undefined);
  if (!sha || !version) throw new Error("usage: release-notes.mjs --version <x.y.z> --sha <sha> [--repo owner/name] | --dry-run");
  const tag = arg(argv, "--tag") ?? (dry ? "build-dry-run" : undefined);
  const sha256 = arg(argv, "--sha256");
  if (assets.includes("contr-mac-universal.zip") && !/^[a-f0-9]{64}$/.test(sha256 ?? "")) {
    throw new Error("Pass the ZIP's SHA-256 as 64 lowercase hex digits with --sha256.");
  }
  const releases = api(`repos/${repo}/releases?per_page=100`);
  const changes = changesFor(api, repo, sha, tag, releases);
  return { notes: notesText(version, sha, changes), file: releaseFile({ version, tag: tag ?? "", sha, date: now.toISOString(), assets, sha256, changes }, releases) };
}

/** The notes text (stdout). */
export function main(argv, env, api) {
  return release(argv, env, api).notes;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const api = (p) => JSON.parse(execFileSync("gh", ["api", p], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
  const argv = process.argv.slice(2);
  const folder = arg(argv, "--assets");
  const { notes, file } = release(argv, process.env, api, new Date(), folder ? readdirSync(folder).sort() : []);
  process.stdout.write(notes);
  const json = arg(argv, "--json");
  if (json) writeFileSync(json, `${JSON.stringify(file, null, 1)}\n`);
}
