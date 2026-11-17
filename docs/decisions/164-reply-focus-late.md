# 164: The reply box takes the keyboard late only if the focus did not move (#159)

This changes one rule of `155-reply-send-focus.md`.

- The box takes the keyboard when the chat has its first full answer. That answer can come late. The box remembers the focused element at two moments: when the chat shows (at start, on another agent's chat, back from Terminal) and when the window becomes active.
- When the first full answer comes, the box takes the keyboard only if the focus is still on the remembered element or on the page body. A control that the owner focused in between keeps the focus.
- The other rules of #155 stay: no take from a text field, a menu or a dialog, while text is selected, or while a card owns the card keys.
- The e2e tab test (`topbar.spec.ts`) failed at random for a different reason. A start shows the stored agent (`tabs.shown`) again while hc lists it, and opens its tab. The test left agent b shown, so the last start opened b's tab again, some time after the test read the tabs. The test now shows agent a before it restarts the app.
