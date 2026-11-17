// node --test scripts/release-notes.test.mjs (CI runs it on each pull request).
import assert from "node:assert/strict";
import { test } from "node:test";
import { main, notesText, release } from "./release-notes.mjs";

const commit = (message) => ({ commit: { message } });

/** A fake GitHub API: the releases list, the compare answer and the commits list. Records each path. */
function fakeApi(releases, compare, commits = []) {
  const paths = [];
  const api = (p) => {
    paths.push(p);
    if (p.startsWith("repos/o/r/releases")) return releases;
    if (p.startsWith("repos/o/r/compare/")) return { commits: compare };
    if (p.startsWith("repos/o/r/commits")) return commits;
    throw new Error(`unexpected ${p}`);
  };
  return { api, paths };
}

test("lists the commits after the newest published release before, newest first, between the version line and the signature lines", () => {
  const releases = [
    { tag_name: "build-2026-11-16-fffffff", published_at: "2026-11-16T10:00:00Z" },
    { tag_name: "build-2026-11-16-aaaaaaa", published_at: "2026-11-16T12:00:00Z" },
    { tag_name: "build-2026-11-15-bbbbbbb", published_at: "2026-11-15T12:00:00Z" },
  ];
  const { api, paths } = fakeApi(releases, [commit("Older change (#1)\n\nbody"), commit("Newer change (#2)")]);
  const text = main(["--version", "0.1.30", "--sha", "ccc", "--repo", "o/r"], {}, api);
  assert.deepEqual(paths, ["repos/o/r/releases?per_page=100", "repos/o/r/compare/build-2026-11-16-aaaaaaa...ccc"]);
  assert.equal(
    text,
    [
      "contr 0.1.30 from ccc.",
      "",
      "## Changes",
      "",
      "- Newer change (#2)",
      "- Older change (#1)",
      "",
      "The macOS app is ad-hoc signed, with no certificate. The first time, open it with right-click > Open",
      "(or run `xattr -dr com.apple.quarantine /Applications/contr.app`).",
      "",
    ].join("\n"),
  );
});

test("skips this release's own tag and releases that are not build-*", () => {
  const { api, paths } = fakeApi([{ tag_name: "build-2026-11-17-ccccccc" }, { tag_name: "v1" }, { tag_name: "build-2026-11-16-aaaaaaa" }], [commit("A (#3)")]);
  main(["--version", "0.1.31", "--sha", "ccc", "--tag", "build-2026-11-17-ccccccc", "--repo", "o/r"], {}, api);
  assert.equal(paths[1], "repos/o/r/compare/build-2026-11-16-aaaaaaa...ccc");
});

test("with no release before, lists the last 20 commits as the API gives them, newest first", () => {
  const { api, paths } = fakeApi([], [], [commit("Third (#3)"), commit("Second (#2)"), commit("First")]);
  const text = main(["--version", "0.1.1", "--sha", "ccc", "--repo", "o/r"], {}, api);
  assert.deepEqual(paths, ["repos/o/r/releases?per_page=100", "repos/o/r/commits?sha=ccc&per_page=20"]);
  assert.match(text, /## Changes\n\n- Third \(#3\)\n- Second \(#2\)\n- First\n\nThe macOS app/);
});

test("with no commits there is no Changes part", () => {
  assert.equal(notesText("0.1.2", "ccc", []).includes("## Changes"), false);
});

test("a dry run uses version 0.0.0 and the sha from SHA or GITHUB_SHA", () => {
  const { api } = fakeApi([{ tag_name: "build-2026-11-16-aaaaaaa" }], [commit("A (#3)")]);
  assert.match(main(["--dry-run"], { GITHUB_REPOSITORY: "o/r", GITHUB_SHA: "merge1" }, api), /^contr 0\.0\.0 from merge1\./);
  assert.match(main(["--dry-run"], { GITHUB_REPOSITORY: "o/r", SHA: "head1", GITHUB_SHA: "merge1" }, api), /^contr 0\.0\.0 from head1\./);
});

test("with no version or sha and no dry run it throws the usage", () => {
  assert.throws(() => main(["--sha", "ccc"], {}, () => []), /usage/);
});

const notes = (v, changes = "") => `contr ${v} from x.\n\n${changes}The macOS app is ad-hoc signed.\n`;

test("release.json has this release first, then the newest 9 published releases by time with their changes", () => {
  const releases = [
    { tag_name: "build-2026-11-17-ccccccc", published_at: "2026-11-17T09:00:00Z", body: notes("0.1.30") },
    { tag_name: "build-2026-11-16-ddddddd", draft: true, published_at: "2026-11-16T13:00:00Z", body: notes("0.1.29") },
    { tag_name: "v1", published_at: "2026-11-16T14:00:00Z", body: "no version" },
    { tag_name: "build-2026-11-15-bbbbbbb", published_at: "2026-11-15T12:00:00Z", body: notes("0.1.27") },
    { tag_name: "build-2026-11-16-aaaaaaa", published_at: "2026-11-16T12:00:00Z", body: notes("0.1.28", "## Changes\n\n- Old change (#5)\n\n") },
    ...Array.from({ length: 12 }, (_, i) => ({ tag_name: `build-2026-10-${10 + i}-eeeeeee`, published_at: `2026-10-${10 + i}T00:00:00Z`, body: notes(`0.0.${i}`) })),
  ];
  const { api } = fakeApi(releases, [commit("New change (#6)")]);
  const argv = ["--version", "0.1.30", "--sha", "ccc", "--tag", "build-2026-11-17-ccccccc", "--repo", "o/r"];
  const { file } = release(argv, {}, api, new Date("2026-11-17T09:30:00Z"), ["contr-mac-universal.dmg", "contr-mac-universal.zip"]);
  assert.deepEqual({ ...file, releases: file.releases.slice(0, 3) }, {
    schema: 1,
    version: "0.1.30",
    tag: "build-2026-11-17-ccccccc",
    sha: "ccc",
    date: "2026-11-17T09:30:00.000Z",
    assets: ["contr-mac-universal.dmg", "contr-mac-universal.zip"],
    releases: [
      { version: "0.1.30", tag: "build-2026-11-17-ccccccc", date: "2026-11-17", changes: ["New change (#6)"] },
      { version: "0.1.28", tag: "build-2026-11-16-aaaaaaa", date: "2026-11-16", changes: ["Old change (#5)"] },
      { version: "0.1.27", tag: "build-2026-11-15-bbbbbbb", date: "2026-11-15", changes: [] },
    ],
  });
  assert.equal(file.releases.length, 10);
  assert.equal(file.releases[9].version, "0.0.5");
});

test("a dry run gives release.json with no assets and only this release when there is no release before", () => {
  const { api } = fakeApi([], [], [commit("A (#3)")]);
  const { file } = release(["--dry-run"], { GITHUB_REPOSITORY: "o/r", SHA: "head1" }, api, new Date("2026-11-17T00:00:00Z"));
  assert.deepEqual(file.releases, [{ version: "0.0.0", tag: "build-dry-run", date: "2026-11-17", changes: ["A (#3)"] }]);
  assert.deepEqual(file.assets, []);
});
