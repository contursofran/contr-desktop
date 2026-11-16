import path from "node:path";

/**
 * The path of a bundled binary (herdr-contr-feed, herdr-contr-orch).
 * The override (an env value) comes first. In the packaged app, appRoot is
 * Resources/app.asar and the binaries are in Resources/bin. Else (dev, e2e)
 * they are in bin/ at the repository root (scripts/fetch-helper).
 */
export function binPath(name: string, appRoot: string, override?: string): string {
  if (override) return override;
  if (path.extname(appRoot) === ".asar") return path.join(path.dirname(appRoot), "bin", name);
  return path.resolve(appRoot, "../../bin", name);
}
