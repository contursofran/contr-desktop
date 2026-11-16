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

## LobeHub icons (`@lobehub/icons-static-svg` 1.102.0)

Files:

- `apps/desktop/src/renderer/sidebar/icons/claude.svg` (from `icons/claudecode-color.svg`)
- `apps/desktop/src/renderer/sidebar/icons/codex.svg` (from `icons/codex-color.svg`)

These two files are byte for byte the same as `defaults/icons/claude.svg` and `defaults/icons/codex.svg` in the Herdr app (herdrdev/herdr-app, Apache-2.0), which takes them from LobeHub icons (MIT) too. herdr-contr draws these files, so the app uses the same icons.

The Claude Code and Codex marks are trademarks of their owners. The app uses them only to name the program that an agent runs.

```
MIT License

Copyright (c) 2023 LobeHub

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

## UI SDK agent skill

`.claude/skills/ui-sdk/` is copied from vercel-labs/ui (https://github.com/vercel-labs/ui),
commit 564de0b, under the Apache License 2.0
(https://www.apache.org/licenses/LICENSE-2.0).
