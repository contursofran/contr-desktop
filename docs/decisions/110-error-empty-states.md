# Error and empty states (#99)

- A failed `feed` shows one block in the reading column, in the card's look, centered in the chat area as herdr-contr's chat centers its error. The words for each helper code come from herdr-contr's `chat.js` (`problem`). The code `helper` is this app's own: "The herdr-contr helper is missing." on ENOENT, else "The herdr-contr helper did not answer." The recipe has no Retry and no path: the block adds the helper path (as Settings shows it) and Retry, which starts the feed again.
- While the helper is down, the reply box is disabled (a disabled `fieldset`, the draft stays) and the status line shows no orchestrator text.
- When `hc ls --json` fails, main sends its error in the sidebar data (`hcError`). With no agents and nothing selected, the main area says "No agents yet" and how an agent appears, or "hc is not reachable." with the error. The Projects part says "No agents" (12 px `muted`, as the recipe's "N more projects, no agents" row). No button: "New tab" is not built.
- The tab row's scrollbar is a 3 px `::-webkit-scrollbar` that takes its own room under the tabs. The overlay thin scrollbar drew over the shown tab's bottom edge.
