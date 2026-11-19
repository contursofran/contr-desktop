// Browser project adapted from pingdotgg/t3code apps/web/vite.config.ts (5b265f8eb7db05df055b2e882d4c10d332076d6b).
// Use Vitest directly, keep contr's unit suite, and save renderer screenshots with the e2e artifacts.
import { resolve } from "node:path";
import { playwright } from "@vitest/browser-playwright";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

declare module "vitest/internal/browser" {
  interface BrowserCommands {
    resetPointer: () => Promise<void>;
    colorScheme: (scheme: "dark" | "light") => Promise<void>;
  }
}

export default defineConfig({
  root: "src/renderer",
  base: "./",
  plugins: [react(), tailwindcss()],
  // Fonts stay files: the CSP (index.html) allows only 'self', so an inlined data: font does not load.
  build: { outDir: "../../out/renderer", emptyOutDir: true, assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined) },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          root: import.meta.dirname,
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: [...configDefaults.exclude, "src/**/*.browser.test.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "browser",
          root: import.meta.dirname,
          include: ["src/**/*.browser.test.tsx"],
          setupFiles: ["./test/browserSetup.ts"],
          attachmentsDir: resolve(import.meta.dirname, "../../tmp/shots/browser/attachments"),
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium", viewport: { width: 1200, height: 800 } }],
            screenshotDirectory: resolve(import.meta.dirname, "../../tmp/shots/browser"),
            commands: {
              resetPointer: async ({ page }) => {
                await page.mouse.move(-1, -1);
                await page.emulateMedia({ colorScheme: "dark" });
              },
              colorScheme: ({ page }, colorScheme: "dark" | "light") =>
                page.emulateMedia({ colorScheme }),
            },
          },
        },
      },
    ],
  },
});
