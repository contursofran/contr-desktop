# 35: Reply box model menu

- The helper has no command that sets the model or the effort. The menu
  sends `/model <id>` and `/effort <level>` through the send path.
- The helper has no event for model, effort and context. The reply box
  asks every 3 s (`REPLY_INFO_INTERVAL_MS`).
- A choice shows at once and stays for 15 s or until the helper agrees
  (herdr-contr #208). The menu opens when the model is not known yet
  (herdr-contr #209). Messages and menu commands go through one queue.
- The design has no agent icon in this app yet: the button uses a plain
  sparkle icon until the sidebar brings the agent icons.
