# Reply box drafts and growth (#98)

- The unsent text and images of the reply box stay for each agent, by terminal, in the renderer's memory (`chat/reply/drafts.ts`). A restart forgets them: herdr-contr's recipe has no rule for drafts. A sent message clears the draft; a failed send keeps it.
- The box grows with its text up to 40% of the window's height (`GROW_LIMIT`), then scrolls inside. The recipe gives no limit.
- The cards, the status line and the reply box keep the chat rows' 16 px side space (one `px-4` wrapper in `App.tsx`).
- In a narrow window the status line cuts the working verb and its detail with an ellipsis; the orchestrator text on the right stays whole.
