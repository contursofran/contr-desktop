#!/usr/bin/env node
// A fake git for tests. `branch --show-current` gives FAKE_GIT_BRANCH.
const [cmd, flag] = process.argv.slice(2);
if (cmd === "branch" && flag === "--show-current") process.stdout.write(`${process.env.FAKE_GIT_BRANCH ?? ""}\n`);
else process.exit(1);
