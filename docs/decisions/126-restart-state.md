# What stays over a restart, and the minimum window size (#113)

- The shown agent is kept in the renderer's localStorage `tabs.shown`, where `tabs.open` and `sidebar.hidden` are. At start the app shows the stored agent while the sidebar lists it; else the agent that `CONTR_TERMINAL` names; else the first agent of the sidebar's list; else none.
- There is no `t1` default. With no stored agent and no `CONTR_TERMINAL`, main has no agent until the renderer picks one.
- The Chat | Terminal pick is one value for the window, in localStorage `view.side`. One value is smaller than a value for each agent, and the recipe says "The pick is one for the window". A bad or missing value gives Chat. A click on another agent keeps the pick.
- The minimum window size is 640 x 480 (`minWidth`, `minHeight`). Measured with the sidebar shown: below about 604 px the reply box's model button breaks onto two lines; the top bar and the sidebar hold. No height down to 320 px breaks the layout, but the chat gets short. 640 keeps a margin and keeps the existing e2e checks at 640 and 700 px. 480 is the herdr-contr-mac height. herdr-contr-mac's 720 px is not used: the layout holds at 640.
