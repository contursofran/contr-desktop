# 155: Sends during a send, the reply box focus, the chat loader (#141)

- Enter during a send queues the new part of the box (the text and images after the parts already on their way) on the same queue as the menu commands. A good send cuts only its own part from the box. Text typed and images attached during the send stay.
- After a failed send, the messages queued behind it do not go. They stay in the box, after the failed text, so the order is kept.
- The reply box takes the keyboard once the chat has its first full answer (at start, on another agent's chat, back from Terminal) and when the window becomes active. It does not take the keyboard from a text field, a menu or a dialog, or while text is selected.
- While a card owns the card keys (the agent's card or an owner question), the box does not take the keyboard. Digits then answer the card. The recipe gives this rule: "It does not take the keyboard while a card of the shown agent has it". A digit typed in the reply box is still text (#101).
- Until the first feed answer, the braille loader and "Reading the chat…" in `muted` cover the empty chat list. The design has no loading state for the chat: this is the smallest one.
