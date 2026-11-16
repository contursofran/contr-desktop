#!/usr/bin/env node
// A fake git for tests. A leading `-C <dir>` is skipped. `branch --show-current` gives FAKE_GIT_BRANCH; `rev-parse --git-common-dir` gives ".git";
// `rev-list --left-right --count` gives FAKE_GIT_COUNTS ("ahead behind"), else fails (no upstream).
let args = process.argv.slice(2);
if (args[0] === "-C") args = args.slice(2);
if (args[0] === "branch" && args[1] === "--show-current") process.stdout.write(`${process.env.FAKE_GIT_BRANCH ?? ""}\n`);
else if (args[0] === "rev-parse") process.stdout.write(".git\n");
else if (args[0] === "rev-list" && process.env.FAKE_GIT_COUNTS) process.stdout.write(`${process.env.FAKE_GIT_COUNTS}\n`);
else process.exit(1);
