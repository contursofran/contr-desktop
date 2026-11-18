# 239: The sidebar as the redesign mock (#227)

- The sidebar's status glyph: working ⠋, idle ⠶ in ink-30, blocked ⠿ in red, on agent and worker rows. A done agent has none (the done glyph is #217).
- No waiting glyph yet. hc and the orchestration tool give no state "waits, not for the owner": the tool's `waiting` is blocked. contursofran/contr-core#27 asks for it.
- An agent row is ink-60, weight 400. A done agent that is not shown has no bold now (this changes decision 55).
- The project chevron is the text "▼" ("▶" when shut, with U+FE0E so it is not an emoji), 9 px, ink-35. It is a control glyph, not text: 3.3:1 in light, over 3:1.
- Each project name is ink-85. The Projects "+" is ink-50.
- The head is one 40 px row: "contr", the machine switch, Search, Hide sidebar (owner, D142; this undoes decision 53). A long machine name is cut with "…". The tooltip and the label for screen readers (`Machine, <name>`) have the full name. The name is `dim`, not the mock's ink-45 (decision 198).
