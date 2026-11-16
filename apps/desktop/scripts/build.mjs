// Bundles the Electron main and preload code to CommonJS in out/.
import { build, context } from "esbuild";

const options = {
  entryPoints: { "main/index": "src/main/index.ts", "preload/index": "src/preload/index.ts" },
  outdir: "out",
  outExtension: { ".js": ".cjs" },
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron"],
  sourcemap: true,
  logLevel: "info",
};

export async function buildMain(watch = false) {
  if (!watch) return build(options);
  const ctx = await context(options);
  await ctx.watch();
  return ctx;
}

if (import.meta.url === `file://${process.argv[1]}`) await buildMain();
