# contr-flow and contr-seq: own SVG drawing

- The chat draws `contr-flow` and `contr-seq` blocks with its own small parse and layout, as plain SVG. No diagram library: the limits (12 boxes, 6 deep, 4 side by side; 6 actors, 16 messages) keep the layout simple.
- Flow layers come breadth first from the boxes with no arrow in. Back arrows curve round the right side, with their label right of the curve. A diagram sits in the middle of its box, as herdr-contr draws a mermaid image.
- State colors: done `done`, running `working`, waiting `blocked`, failed `pr-closed`, info `muted`. The design names no colors for `failed` and `info`; this is the simplest choice.
- A block that does not parse, or goes past a limit, shows as code.
