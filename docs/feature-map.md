# Feature map

Each feature of the app from the owner's view, grouped by view. It is the guide for an explorer and the rubric for a
screenshot check. Start the app with the `verify` skill (`.claude/skills/verify/SKILL.md`): with no switches it shows
the data in the "Expected" column. Data that needs a switch names it.

A selector is `role "name"` as `getByRole` takes it, `label "name"` as `getByLabel` and `text "…"` as `getByText`;
`a > b` is `b` inside `a`. The skill's `click`, `text` and `roles` take the same words. "Spec" is the file in
`apps/desktop/e2e/` that tests the feature. When the code changes a feature, update its row in the same PR.

## Sidebar

| Feature | The owner does | Path or keys | Selector | Expected | Spec |
|---|---|---|---|---|---|
| Projects and agents | Looks at the sidebar | — | `navigation "Projects"`, `region "contr-desktop"` | One row per project (folder icon, name, branch `main`); its agents under it; "Chat panel usability audit" has "Orchestrating · 3 workers" and its workers b-30, b-40, b-50 under it | `sidebar`, `sidebar-projects` |
| Open an agent's chat | Clicks an agent or worker row | Click | `navigation "Projects" > button "Install health check"` | The chat, the tab and the reply box ("Reply to Install health check") switch to that agent | `sidebar`, `topbar` |
| A worker's own chat | Clicks a worker row | Click | `button /Cards for prompts and questions/` | The reply box, model, context and status line are the worker's | `sidebar` |
| Fold a project | Clicks the chevron of a project | Click | `button "Shut contr-desktop"`, then `button "Open contr-desktop"` | Its agents hide, then show again | `sidebar` |
| Inbox row | Looks at, then clicks, the row above Projects | Click | `button /^Inbox/` | "Inbox · N" with open items, "Inbox" with none; a click opens the Inbox | `inbox` |
| Machine switch | Opens the machine menu | Click, or Enter on the button | `button "Machine"`, `menuitemradio "This computer"` | "This computer" is checked; aerum-pc, vps and tmp-1 are inert with "(not yet)"; "Add machine…" is inert; focus comes back to the button | `popups`, `small-texts`, `sidebar-head-foot` |
| Search | Hovers or focuses the search icon | — | `button "Search"` | Inert, tooltip "Search (not yet)" | `popups`, `sidebar-head-foot` |
| Hide and show the sidebar | Clicks the panel icon | Click | `button "Hide sidebar"`, then `button "Show sidebar"` in the top bar | The sidebar hides; the top bar's button shows it again, clear of the window buttons; the state stays over a restart | `sidebar-head-foot` |
| Plan usage | Looks at the foot | — | `list "Plan usage" > listitem "Claude"`, `meter "Claude usage"` | Claude "64% wk · 4d", Codex "21% 5h · 3h"; the tooltip says when the data was read; `FAKE_HELPER_USAGE=stale`: "—" and an empty meter | `usage`, `sidebar-head-foot` |
| Settings | Clicks Settings in the foot | Click | `button "Settings"` | The Settings view opens | `settings` |
| Add machine (foot +) | Hovers the + | — | `button "Add machine"` | Inert, tooltip "Add machine (not yet)" | `sidebar-head-foot` |
| Tooltips | Hovers or focuses a row or an icon | Hover, Tab; Escape hides | the row's `button` | The tooltip shows the full title; Escape or leaving hides it | `popups` |
| No agents | Starts with no agents | `CONTR_TERMINAL= FAKE_HC_AGENTS=` | text "No agents" | The sidebar says "No agents" | `states` |

## Top bar

| Feature | The owner does | Path or keys | Selector | Expected | Spec |
|---|---|---|---|---|---|
| Tabs | Opens agents from the sidebar | — | `tablist "Tabs" > tab` | One tab per opened agent, the shown one selected, with its title whole | `topbar` |
| Switch by tab | Clicks a tab | Click | `tab "Install health check"` | The chat switches | `topbar` |
| Close a tab | Clicks the × of the shown tab | Click | `button "Close Install health check"` | The tab closes; the app reads that agent's feed no more | `topbar`, `helper-calls` |
| Move a tab | Drags a tab, or presses keys on it | Alt+Left, Alt+Right, Alt+Home, Alt+End | `tab "<title>"` | The tab moves; the order stays over a restart | `topbar` |
| New tab | Hovers the + | — | `button "New tab"` | Disabled, tooltip "New tab (not yet)" | `topbar`, `popups` |
| Chat or Terminal | Clicks the switch at the top right of the work area, under the tab bar | Click | `group "Chat or Terminal" > button "Terminal"` | The work area shows the agent's terminal; the pick stays over a restart | `fake-terminal`, `restart` |
| Many tabs | Opens more tabs than fit | `size=640x480` | `tablist "Tabs"` | The row scrolls; the shown tab scrolls into view; a thin scrollbar below the tabs | `topbar`, `states` |

## Chat

| Feature | The owner does | Path or keys | Selector | Expected | Spec |
|---|---|---|---|---|---|
| Messages | Reads the chat | — | `list "Chat"` | The owner's messages as right-aligned blocks with the selected fill; the agent's text as Markdown | `app` |
| Markdown | Reads lists, tables, code, diffs | — | `list "Chat"` | Code in a hairline frame with a language label and Copy; tables with hairlines; links in the brightest ink, underlined; diff lines colored; long words wrap | `app`, `markdown` |
| Copy code | Clicks Copy on a code block | Click | `button "Copy code"` | The code is on the clipboard; the button says "Copied" | `app`, `uisdk-settings` |
| Tool calls | Opens an answer's tool line | Click, or Enter on the line | `button "Searched 2 patterns, read 1 file"` | One line of the helper's chip labels; it opens to one line per call: the command or path, ✕ when it failed, the first line of its result (`aria-expanded`) | `tool-calls`, `keys`, `app` |
| Turn foot | Reads the end of a turn | — | text /Worked/ | "14:06 · Worked 1m 0s · 6 tools", the helper's text, in mono | `app`, `colors`, `tool-calls` |
| Compaction line | Reads a compaction | — | text "Context compacted" | A thin centered line on hairlines | `tool-calls` |
| PR and issue chips | Reads `#12` in a message | `CONTR_REPO_DIR=<a folder in tmp/>` | `link "PR #12, Merged, 6 of 6 checks passed"` | A chip with gh's state: the GitHub icon and a faint outline in the `pr-*` or `issue-*` token, the number in ink (dim when closed without a result; a closed PR is grey); a PR with checks adds ✓ 6/6, the working glyph and 4/6, or ✕ 1 (not in a copied selection); an unknown number stays text | `chips` |
| Links | Clicks a link | Click | `link "Electron docs"` | The browser opens it (in e2e: a line in `open.log`); the app does not navigate | `links` |
| Remarks | Reads `> [!NOTE]` and other remarks | `fixture=remarks-session` | — | A label column and the text, no bar; only "Decision needed" is red; local images draw in a hairline frame | `remarks` |
| Board and queue | Reads `contr-status` and `contr-queue` | `fixture=blocks-session` | `list "Workers"`, `list "Merge order"`, `[data-testid=board-same]` | A board with each worker's step and chip, and "Running, no change" for `contr-status same`; the queue as a rail: done, now, next from gh, each note with its chips; a bad block stays code | `blocks` |
| Digest | Reads `contr-digest` | `fixture=digest-session` | `region "Since you left"`, `[data-cell]` | PRs merged and CI failures from gh, workers busy and items for you from the orchestration tool; red only for items for you; a block with text stays code | `digest` |
| Diagrams | Reads `contr-flow` and `contr-seq` | `fixture=diagrams-session` | — | A flow left to right (the running box brightest, done boxes dim with ✓, back arrows dashed below); a sequence with a message to the owner in red; a block past a limit shows as code | `diagrams` |
| Charts | Reads `contr-chart bar` and `contr-chart line` | `fixture=charts-session` | `list "Bar chart"`, `img "Line chart, …"` | Grey bars, largest first, with the value and note as text; a line with the latest point brightest and one outlier labelled; an unknown kind stays code | `charts` |
| Task lists | Reads `- [x]` items | — | — | Check boxes in theme colors | `tasklist` |
| Pictures | Reads a message with a picture | `fixture=missing-picture-session` | — | A local picture draws; one that cannot load is a muted chip; a web picture stays a link | `missing-picture`, `markdown` |
| Right-to-left text | Reads Arabic or Hebrew | `fixture=rtl-session` | — | Right-to-left base; code and English stay left to right | `rtl` |
| Reading column | Looks at a wide and a narrow window | `size=1440x900`, `size=640x600` | — | At most 760 px, centered, 56 px side padding (16 px under 768 px); its parts line up; the text ends left of the Chat or Terminal switch | `column` |
| Follow the end | Gets new rows | — | `list "Chat"` | The chat follows new rows at the end, and stays put when scrolled up | `scroll` |
| Jump to the end | Scrolls up, then clicks ↓ | Click; Tab from the reply box | `button "Jump to the end"` | The button shows away from the end, marks new rows, and goes back to the end | `jump` |
| Loading | Opens a chat before the first feed answer | `FAKE_HELPER_SLOW_FEED=3000` | `status "Reading the chat"` | The loader and "Reading the chat…" | `reply-send` |
| Helper error | Opens a chat when the helper fails | `FAKE_HELPER_ERROR=<code>` | `alert "Helper error"`, `button "Retry"` | Plain words, the error, the helper path with Copy, Retry; the reply box is off | `states`, `app`, `small-texts` |
| No agent | Starts with no agent | `CONTR_TERMINAL= FAKE_HC_AGENTS=` | `status "No agent"` | "No agents yet": the main area says how an agent shows | `states` |
| hc not reachable | Starts when hc cannot run | `FAKE_HC_DOWN=<a file that exists>` | `alert "hc error"`, `button "Retry"` | "hc is not reachable" with the error; Retry reads again | `states`, `terminal-error` |

## Cards

| Feature | The owner does | Path or keys | Selector | Expected | Spec |
|---|---|---|---|---|---|
| Permission card | Allows or denies a tool | Keys 1, 2, …; click | `region "Approval" > button /Allow once/` | The answer goes to the helper (`FAKE_HELPER_ANSWER_LOG`); a changed prompt says so | `cards` |
| Question card | Picks an answer | Keys 1, 2, …; Enter | `region "Question"`, `button "Next"`, `button "Send"` | The pick goes; multi-select takes picks; Next and Send are off until there is a pick or own text | `cards` |
| One question card | Looks at a permission, a question or a pick-any question | `FAKE_HELPER_CARD` | `region "Approval"`, `region "Question"`, `region "Owner question"` | The reply box's fill and line (`--side`, `--input-line`), no shadow; a red glyph in the head; check boxes for pick-any; "Or type an answer" and the keys line | `cards`, `owner` |
| Own answer | Types an own answer | Type, Enter | `textbox "Own answer"` | A number typed there is text, not a pick | `cards`, `keys` |
| Card keys | Presses a number | 1, 2, … | — | With focus in the reply box a 1 stays text; with focus on the page it answers | `keys`, `focus` |
| Stacked cards | Has an agent card and owner items | `FAKE_HELPER_CARD`, `FAKE_ORCH_OWNER`, `size=640x480` | `region "Approval"`, `region "Owner question"`, `region "Owner to-do"` | The cards scroll inside; the reply box stays in the window; key 1 answers only the agent's card | `stacked-cards` |
| Card width | Looks at a card in a small window | `size=900x600` | `region "Approval"` | The chat rows' side space: 56 px, 16 px under 768 px | `cards` |

## Reply box

| Feature | The owner does | Path or keys | Selector | Expected | Spec |
|---|---|---|---|---|---|
| Send | Types and sends | Type, Enter; or click | `textbox "Reply to Chat panel usability audit"`, `button "Send"` | The text goes (`send.log`) and the box clears | `app`, `reply-send` |
| Send during a slow send | Types or presses Enter while a send runs | `FAKE_HELPER_SLOW_SEND=2000` | `textbox /^Reply to/` | New text stays; a second Enter queues the next message; both go in order | `reply-send` |
| Failed send | Sends when the helper fails | `FAKE_HELPER_SEND_ERROR=<code>` | `form "Reply"` | An error shows; the text stays | `app`, `reply-send` |
| Attach an image | Clicks + and picks a file, or pastes | Click; Cmd+V | `button "Attach image"`, `list "Attachments"` | A picture 56 px high or a chip; its path goes with the text | `attach`, `app` |
| Remove an attachment | Clicks × on it | Click, Enter or Space | `button "Remove shot.png"` | Only that one leaves | `attach` |
| Status line | Looks above the reply box | — | label "Status" | The working glyph ⠋, "Hashing…" and "35s · ↓ 1.2k tokens" in mono; on the right "Orchestrating · 3 workers"; a narrow window cuts the detail | `reply`, `orchestrate` |
| Orchestrate | Clicks Orchestrate on an agent with no workers | Click | `button "Orchestrate"` | `/contr:orchestrate` is in the reply box, not sent | `orchestrate` |
| Model and effort | Opens the model menu | Click; arrows, Enter, Escape | `button "Model"`, `menu "Model" > menuitemradio "Sonnet 5"` | The button has the agent icon (the Claude pet), model and effort; the menu sends `/model` and `/effort`; focus comes back to the button | `reply` |
| Context and branch | Looks at the right of the foot | — | label "Context 37%", label "Branch" | The ring with 37% in mono and its tooltip; the branch `main` in mono | `reply`, `uisdk-settings` |
| Drafts | Types, then switches agent, Inbox or Settings | — | `textbox /^Reply to/` | The draft stays for each agent; a send clears it | `reply` |
| Grow | Types many lines | — | `textbox /^Reply to/` | The box grows up to 40% of the window, then scrolls; shrinks after a send | `reply` |
| Focus | Opens a chat or comes back to the window | — | `textbox /^Reply to/` | The box takes the keyboard, but not from a chat selection, an open menu or a card that owns the keys | `focus` |
| Tab order | Presses Tab | Tab | — | Top bar, card, reply box, then ↓ and the chat rows | `keys`, `jump` |

## Terminal

| Feature | The owner does | Path or keys | Selector | Expected | Spec |
|---|---|---|---|---|---|
| Terminal view | Clicks Terminal | Click | `button "Terminal"` | The agent's hc terminal (xterm.js) with no frame, in JetBrains Mono 13/20; keys go to it | `terminal`, `fake-terminal`, `terminal-error` |
| Terminal error | Opens Terminal when hc cannot attach | `FAKE_HC_CONNECT=1 FAKE_HC_DOWN=<a file that exists>` | `alert "Terminal error"`, `button "Retry"` | One centered note with no box: "The connection to hc ended.", hc's words in mono, Retry; Retry attaches when the file is gone; when the sidebar's "hc is not reachable" clears, the terminal attaches again with no Retry; `FAKE_HC_CONNECT=bad-hello` shows a plain note | `terminal-error`, `hc-outage` |

## Inbox

| Feature | The owner does | Path or keys | Selector | Expected | Spec |
|---|---|---|---|---|---|
| Open items | Opens the Inbox | Click | `region "Inbox"` | One row per open item, oldest first: glyph, id, text, kind, from, coordinator, end. The oldest is open as its card | `inbox` |
| Move between items | Opens another item | `ArrowDown`, `ArrowUp`, or a press on a row | `region "Inbox" [data-item]` | That item opens as its card; the one before goes back to one line | `inbox` |
| Answer a question | Picks an answer or writes one | Click, keys (in the Inbox, the open item takes 1-9 and Enter); `button "Send answer"` | `region "Owner question"` | The item closes everywhere; the next shows | `owner`, `inbox` |
| Mark a to-do done | Clicks Done | Click | `region "Owner to-do" > button "Done"`, or `button "Done"` at the end of a closed to-do row | The item closes; Copy copies a command in it | `owner`, `inbox` |
| Blocked agent | An agent or worker waits on a prompt | `FAKE_HELPER_CARD` | `region "Inbox"` | A row after the owner items, with the agent's title, "Waits on a prompt" and "Open chat"; a press opens its chat with the card; it closes when the agent goes on | `inbox` |
| Failed answer | Answers when the tool fails | `FAKE_ORCH_OWNER_FAIL=1`, `FAKE_ORCH_OWNER_UNREACHED=1` | `region "Owner question"` | The card stays with the tool's message; "coordinator not reached" shows the note alone | `owner` |
| Failed read | The tool's list cannot be read | `FAKE_ORCH_OWNER_BAD=<file>` | `region "Inbox"` | The last good list and the typed text stay; the Inbox says why | `owner-read` |

## Settings and updates

| Feature | The owner does | Path or keys | Selector | Expected | Spec |
|---|---|---|---|---|---|
| Theme | Picks System, Light or Dark | Click; Left and Right arrows | `region "Settings" > radiogroup "Theme"` | The theme changes and stays over a restart; one Tab stop | `settings`, `theme`, `uisdk-settings` |
| Helper path | Reads the helper path | — | label "Helper path", `button "Copy path"` | The path in mono, cut from the left so the file name shows; the whole path in a tooltip; Copy says "Copied" | `settings`, `small-texts` |
| Version | Reads the version part | — | label "Newest version" | "Development build" with no release URL, and no Update button | `update` |
| Check for updates | Clicks Check now, or the app menu's Check for Updates… | Click | `button "Check now"` | In the group head: "Checking…", then the last check; the newest version in its row | `update` |
| Update | Clicks Update | `CONTR_UPDATE_URL`, `CONTR_VERSION` | `button "Update"`, label "Update ready" | A dot in the foot; the .dmg downloads, or the .zip installs and shows "Restart to update"; failures show their message | `update`, `update-file` |
| Change log | Reads the releases | `CONTR_RELEASES_URL` | `region "Change log"`, `button "Show older"`, `button "Retry"` | Newest first, with marks and dates; Loading, a failure text with Retry | `changelog`, `update-file` |
| Window size | Makes the window small | — | — | The window is at least 640 × 480 | `restart` |
| Restart | Quits and starts the app | — | — | The shown agent, the Chat or Terminal pick, the tab order and the sidebar state stay; with `FAKE_HC_DOWN=<a file that exists>` the saved tabs stay, and get their titles when hc is back | `restart`, `topbar`, `sidebar-head-foot`, `hc-outage` |

## Core

| Feature | The owner does | Path or keys | Selector | Expected | Spec |
|---|---|---|---|---|---|
| Core helper | Has a core home with a newer helper | `CONTR_CORE_HOME=<temp folder>`, `CONTR_CORE_BUNDLE` | label "Helper path" in Settings | The newer helper runs; one that does not start falls back to the bundle; a root shared with the Herdr app runs the bundle | `core` |

## Features with no test

- The app menu's items other than Check for Updates… (About, Hide, Quit, and the Edit, View and Window menus): Electron's
  own roles.
