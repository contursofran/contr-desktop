export const CODEX_ORCHESTRATION_RULE = `## Contr orchestration

When I ask you to orchestrate from a terminal with \`HC_TERMINAL_ID\` set,
use the [contr orchestration playbook](https://github.com/contursofran/contr-core/blob/main/kit/commands/orchestrate.md).
Read the flow with \`herdr-contr-orch agents flow\`. If the CLI is absent
from \`PATH\`, look in the installed contr app's \`Contents/Resources/bin/\`.
Start workers with contr MCP \`spawn\` or \`herdr-contr-orch agents spawn\`.
Keep the current terminal as their parent. Use contr MCP \`list\` or
\`herdr-contr-orch agents ls --json\` to confirm that each live worker's
parent matches \`HC_TERMINAL_ID\`.

If the native tools or coordinator are unavailable, report the blocker
before assigning work. Use Codex subagents for orchestration only when I
explicitly ask for them. Follow the repo's rules and manage only workers
of the current coordinator.
`;
