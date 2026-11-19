import { appChildren } from "../children";

/** The current branch in `cwd` (`git branch --show-current`). Null on a detached HEAD or an error. CONTR_GIT picks the git program. */
export function gitBranch(cwd: string, git = process.env.CONTR_GIT ?? "git"): Promise<string | null> {
  return new Promise((resolve) => {
    appChildren.execFile(git, ["branch", "--show-current"], { cwd, timeout: 5000 }, (error, stdout) => {
      const branch = String(stdout ?? "").trim();
      resolve(error || branch === "" ? null : branch);
    });
  });
}
