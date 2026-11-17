// node --test scripts/release-notes.test.mjs (CI runs it on each pull request).
import assert from "node:assert/strict";
import { test } from "node:test";
import { main, notesText } from "./release-notes.mjs";

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
