# Start Codex chats through App Server

See [Show Codex chats in Projects](324-codex-chat-sidebar.md) for the current view and connection.

New tab → Codex starts a thread in the project folder. The desktop app
receives chat and tool events over a private Unix socket and sends prompts
and approval decisions through the same connection.

After the first turn, the Terminal switch starts the Codex TUI in hc with
the same thread ID and socket. Codex needs a saved rollout to resume a
thread. The app uses the saved tab ID to resume the chat on restart.

Codex sessions started outside the app keep the helper feed.
