#!/usr/bin/env node
// A fake hc for tests. `get --json <terminal>` gives FAKE_HC_TITLE as the title and FAKE_HC_CWD as the cwd.
const [cmd, , terminal] = process.argv.slice(2);
if (cmd === "get") process.stdout.write(`${JSON.stringify({ address: terminal, name: "w-7", title: process.env.FAKE_HC_TITLE ?? "", cwd: process.env.FAKE_HC_CWD ?? "" })}\n`);
else process.exit(1);
