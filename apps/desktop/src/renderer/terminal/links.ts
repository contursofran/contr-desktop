// Adapted from wavetermdev/waveterm frontend/app/view/term/term-links.ts
// at 9f1c9670d407be3b93cf090319a63ef30bf54d0e. Keep the activation handler.
// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

export function makeTermLinkHandler(isMacOS: boolean, openUri: (uri: string) => void) {
  return (event: MouseEvent, uri: string) => {
    event.preventDefault();
    if (!(isMacOS ? event.metaKey : event.ctrlKey)) {
      return;
    }
    openUri(uri);
  };
}
