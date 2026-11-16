#!/usr/bin/env node
// A fake git for tests. `branch --show-current` gives FAKE_GIT_BRANCH; `-C <dir> rev-parse --git-common-dir` gives ".git".
const args = process.argv.slice(2);
if (args[0] === "branch" && args[1] === "--show-current") process.stdout.write(`${process.env.FAKE_GIT_BRANCH ?? ""}\n`);
else if (args[0] === "-C" && args[2] === "rev-parse") process.stdout.write(".git\n");
else process.exit(1);
