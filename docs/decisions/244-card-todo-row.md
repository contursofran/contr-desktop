# The owner to-do row and the picked answer (#231)

- In the chat, an owner to-do is one row (`screens.html` screen 1, `.todo`): the id, the first paragraph cut to one
  line, "To do · from b-15 · 3 commands", then Show and Done. The commands are the copy rows of `splitTodo`. Show
  opens the whole text with its copy rows in place; Done closes the item through the orchestration tool. The Inbox
  keeps the whole to-do card. The row has no "1 more after this": the Inbox lists every to-do.
- A one-choice agent question starts with its first answer picked (`.opt.is-picked`): the `--hover` fill, and Enter
  sends it. Own text takes the place of that pick. The permission card's "Allow once" is picked the same way, so Enter
  allows it. A pick-any question starts with no pick: a check the owner did not set would go out.
- A one-choice answer's detail is a line under its label (`.opt .d`); a pick-any answer keeps the mono hint after its
  label (`.opt .hint`).
- The head of an agent's card names the shown agent (the sidebar's name and title) and the card's age, then the
  source's text. hc and the helper give no time for a prompt, so the age counts from the time the card came to the
  chat. It starts again when the chat mounts again.
- The permission card has no "Or type an answer" field: the helper's `approve` sends only allow or deny
  (contursofran/contr-core#28).
