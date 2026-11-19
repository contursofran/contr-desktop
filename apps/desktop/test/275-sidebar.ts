import type { Sidebar } from "../src/shared/api";

export const sidebar: Sidebar = {
  selected: "t7",
  projects: [
    {
      name: "contr-desktop", cwd: "/work/contr-desktop", branch: "main", ahead: 0, behind: 0, favicon: null,
      agents: [
        {
          terminal: "t7", title: "Chat panel usability audit", name: "orch-contr-desktop",
          kind: "claude-code", state: "working", issue: null, workers: [
            { terminal: "t8", title: "Flow and sequence diagrams", name: "b-30", kind: "claude-code", state: "working", issue: "30", workers: [] },
            { terminal: "t9", title: "Cards for prompts and questions", name: "b-40", kind: "claude-code", state: "blocked", issue: "40", workers: [] },
            { terminal: "t10", title: "Virtual list", name: "b-50", kind: null, state: "done", issue: null, workers: [] },
          ],
        },
        { terminal: "t11", title: "Release notes draft", name: "notes", kind: "claude-code", state: "done", issue: null, workers: [] },
      ],
    },
    {
      name: "herdr-contr", cwd: "/work/herdr-contr", branch: "main", ahead: 0, behind: 0, favicon: null,
      agents: [{ terminal: "t12", title: "Install health check", name: null, kind: "codex", state: "working", issue: null, workers: [] }],
    },
  ],
};
