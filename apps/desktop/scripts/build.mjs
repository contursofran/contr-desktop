// Bundles the Electron main and preload code to CommonJS in out/.
import { build, context } from "esbuild";

const options = {
  entryPoints: {
    "main/index": "src/main/index.ts",
    "main/report-terminal": "src/main/codex/report-terminal.ts",
    "preload/index": "src/preload/index.ts",
  },
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

export async function watchMain(onBuilt) {
  const ctx = await context({
    ...options,
    plugins: [{
      name: "restart-electron",
      setup(builder) {
        builder.onEnd((result) => {
          if (!result.errors.length) return onBuilt();
        });
      },
    }],
  });
  await ctx.watch();
  return ctx;
}

if (import.meta.url === `file://${process.argv[1]}`) await build(options);
