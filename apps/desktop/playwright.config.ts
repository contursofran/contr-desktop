import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  // Record each file's duration in CI so runs can be compared before sharding.
  ...(process.env.CI ? { reportSlowTests: { max: 0, threshold: 0 } } : {}),
});
