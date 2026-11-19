# Merge times and owner items in queue notes (#240)

- The same GitHub ref query reads `mergedAt`. A merged PR shows its local time in 24-hour format under the step.
- A note can end with ` | owner: D7` for a question or ` | owner: T3` for a to-do. Contr looks up the ID in the current chat's open owner items.
- The chip shows the ID and exposes the question title in its accessible label. If the item is unavailable, the note shows the ID as text.
