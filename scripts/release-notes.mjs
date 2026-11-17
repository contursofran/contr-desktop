#!/usr/bin/env node
// Writes the notes of a release to stdout (release.yml, job publish, step Notes).
// The first line gives the version, as the update check reads it. Then a "## Changes" part: the subject of each
// commit after the release before this one, up to this release's commit, newest first. No release before: the
// last 20 subjects. Then the lines about the ad-hoc signature (docs/reference/releases.md).
// It reads the releases and the commits with the GitHub API (gh api), so the job needs no git history.
//
//   node scripts/release-notes.mjs --version 0.1.30 --sha <sha> [--tag <this tag>] [--repo owner/name]
//   node scripts/release-notes.mjs --dry-run     # CI on a pull request: version 0.0.0, sha $SHA or $GITHUB_SHA
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** With no release before, the notes list this many commits. */
export const FIRST_COUNT = 20;

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

/** Gathers the subjects for `sha`; `api(path)` returns the parsed JSON of a GitHub API path. */
export function changesFor(api, repo, sha, own) {
  const before = previousTag(api(`repos/${repo}/releases?per_page=100`), own);
  if (!before) return subjects(api(`repos/${repo}/commits?sha=${sha}&per_page=${FIRST_COUNT}`), true);
  return subjects(api(`repos/${repo}/compare/${before}...${sha}`).commits ?? [], false);
}

function arg(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

export function main(argv, env, api) {
  const dry = argv.includes("--dry-run");
  const repo = arg(argv, "--repo") ?? env.GITHUB_REPOSITORY ?? "contursofran/contr-desktop";
  const sha = arg(argv, "--sha") ?? (dry ? (env.SHA || env.GITHUB_SHA) : undefined);
  const version = arg(argv, "--version") ?? (dry ? "0.0.0" : undefined);
  if (!sha || !version) throw new Error("usage: release-notes.mjs --version <x.y.z> --sha <sha> [--repo owner/name] | --dry-run");
  return notesText(version, sha, changesFor(api, repo, sha, arg(argv, "--tag")));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const api = (p) => JSON.parse(execFileSync("gh", ["api", p], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
  process.stdout.write(main(process.argv.slice(2), process.env, api));
}
