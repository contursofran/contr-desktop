// Adapted from pingdotgg/t3code apps/web/test/browserSetup.ts (5b265f8eb7db05df055b2e882d4c10d332076d6b).
// Use Vitest directly and reset the test color scheme along with the pointer.
import { beforeEach } from "vitest";
import { commands } from "vitest/browser";

// The pointer survives between tests. Park it away from the next test's controls.
beforeEach(async () => {
  await commands.resetPointer();
});
