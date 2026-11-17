import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { IMAGE_SCHEME } from "../localImages";
import { runRead } from "./agents";

const FAVICON_DIRS = ["", "public", "static", "app", "src/app", "assets", "web"];
const FAVICON_NAMES = [["favicon.svg", "favicon.png"], ["apple-touch-icon.png", "icon.png", "icon.svg"]];

/** The project's favicon file, as herdr-contr looks (docs/design/recipe-herdr.md): the first file found wins; no `.ico`. */
export function findFavicon(dir: string): string | null {
  if (!dir) return null;
  for (const names of FAVICON_NAMES) {
    for (const sub of FAVICON_DIRS) {
      for (const name of names) {
        const file = path.join(dir, sub, name);
        if (existsSync(file) && statSync(file).isFile()) return file;
      }
    }
  }
  return null;
}

/** The favicon as a URL that the renderer can load, else null. */
export function faviconUrl(dir: string): string | null {
  const file = findFavicon(dir);
  return file ? `${IMAGE_SCHEME}://local${file.split(path.sep).map(encodeURIComponent).join("/")}` : null;
}

/** Reads `ahead behind` from `git rev-list --left-right --count HEAD...@{upstream}`; 0 0 with no upstream. */
export function parseCounts(out: string): { ahead: number; behind: number } {
  const [a, b] = out.trim().split(/\s+/).map(Number);
  return Number.isInteger(a) && Number.isInteger(b) ? { ahead: a!, behind: b! } : { ahead: 0, behind: 0 };
}

/** The branch and the commits ahead and behind in `cwd`. `exec` runs git (`runRead`). */
export async function gitState(git: string, cwd: string, exec = runRead): Promise<{ branch: string | null; ahead: number; behind: number }> {
  if (!cwd) return { branch: null, ahead: 0, behind: 0 };
  const [branch, counts] = await Promise.all([
    exec(git, ["-C", cwd, "branch", "--show-current"]),
    exec(git, ["-C", cwd, "rev-list", "--left-right", "--count", "HEAD...@{upstream}"]),
  ]);
  return { branch: branch.out.trim() || null, ...parseCounts(counts.out) };
}
