# Reply box drafts and growth (#98)

- The unsent text and images of the reply box stay for each agent, by terminal, in the renderer's memory (`chat/reply/drafts.ts`). A restart forgets them: herdr-contr's recipe has no rule for drafts. A sent message clears only the text and images that it sent (#141); a failed send keeps them.
- The box grows with its text up to 40% of the window's height (`GROW_LIMIT`), then scrolls inside. The recipe gives no limit.
- The cards, the status line and the reply box keep the chat rows' side space (one wrapper in `App.tsx`). Decision 229 changed it to 56 px, 16 px under 768 px.
- In a narrow window the working verb stays whole and the status line cuts its detail with an ellipsis (#101); the orchestrator text on the right stays whole.
