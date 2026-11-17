# 135: Small texts and tooltips

- The machine pick does not filter the Projects list yet (decision 49). Machines other than "This computer" are now inert, as "Add machine…" is: disabled, `faint`, and the tooltip "<name> (not yet)". The label always says "This computer". A picked machine shown over this computer's agents would be wrong data.
- The reply box says "Reply" while the title is not known: an empty title, or "Terminal", which is the fallback that `readTabTitle` gives to a terminal with no title and no agent.
- The model menu has "Model" and "Effort" group titles over the two lists. The design's menu (chevron rows, "More models") is not built yet.
- The model button's tooltip is "Opus 5.5 · medium effort · Claude Code", without the folder, because the renderer does not get the agent's folder. The context ring's tooltip is "37% of the model's context window". The helper gives no token counts.
- A tab is at most as wide as the tab row, and its title truncates. A tab that is wider than the row shows from its start.
- A path (`ui/PathText.tsx`) has a tooltip with the whole path and a Copy button that works like the code block's Copy.
