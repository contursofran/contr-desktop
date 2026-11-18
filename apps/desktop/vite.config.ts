import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: "src/renderer",
  base: "./",
  plugins: [react(), tailwindcss()],
  // Fonts stay files: the CSP (index.html) allows only 'self', so an inlined data: font does not load.
  build: { outDir: "../../out/renderer", emptyOutDir: true, assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined) },
  test: { root: ".", include: ["src/**/*.test.{ts,tsx}"] },
});
