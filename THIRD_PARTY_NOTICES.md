# Third-party notices

## t3code

- Source: https://github.com/pingdotgg/t3code
- Pinned commit: `b5554ac8114f2ce7ce8b5973690ccb8cbb248efd` (t3code main on 2026-11-16).
- Copied files: each copied file names its source path and this commit in a
  header, and says what we changed. This section lists the copied files by
  folder.
  - `apps/desktop/src/renderer/chat/markdown/`: `markdownGithubAlerts.ts`,
    `markdownListIndentation.ts`, `markdownOrderedListNumbers.ts`,
    `markdownRenderer.ts`, `pipeline.ts` (part), `syntaxHighlighting.ts`,
    `MarkdownCodeBlock.tsx` (part), `MarkdownTable.tsx` (part), `markdown.css`
    (adapted).
  - `apps/desktop/src/renderer/chat/refs/`: `pullRequestIcons.tsx` (adapted),
    `ContextChip.tsx` (part).

## @pierre/diffs

The code highlighter (npm `@pierre/diffs`, with `@pierre/highlights` WASM
lexers) is a dependency, under the Apache License 2.0.

```text
MIT License

Copyright (c) 2026 T3 Tools Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
