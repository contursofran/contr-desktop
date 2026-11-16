import { describe, expect, it } from "vitest";
import { mergePath, parsePath, readLoginShellPath, syncShellPath } from "./path";

describe("parsePath", () => {
  it("takes the value between the markers and ignores startup noise", () => {
    expect(parsePath("Welcome!\nnvm loaded\n__CONTR_PATH_START__/a:/b__CONTR_PATH_END__\nbye")).toBe("/a:/b");
  });
  it("returns null without both markers or with an empty value", () => {
    expect(parsePath("/a:/b")).toBeNull();
    expect(parsePath("__CONTR_PATH_START__/a")).toBeNull();
    expect(parsePath("__CONTR_PATH_START____CONTR_PATH_END__")).toBeNull();
  });
});

describe("mergePath", () => {
  it("keeps order and drops duplicates and empty entries", () => {
    expect(mergePath("/a:/b", "/b:/c::", null, undefined, "/a:/d")).toBe("/a:/b:/c:/d");
  });
});

describe("syncShellPath", () => {
  it("puts the shell PATH first and adds the fallback dirs", () => {
    const env: NodeJS.ProcessEnv = { HOME: "/h", PATH: "/usr/bin:/bin", SHELL: "/bin/fish" };
    let used = "";
    syncShellPath(env, (sh, args, t) => {
      used = `${sh} ${args[0]} ${t}`;
      return "noise\n__CONTR_PATH_START__/h/.local/bin:/usr/bin__CONTR_PATH_END__";
    });
    expect(used).toBe("/bin/fish -ilc 3000");
    expect(env.PATH).toBe("/h/.local/bin:/usr/bin:/bin:/opt/homebrew/bin:/usr/local/bin");
  });
  it("keeps the fallback when the shell times out", () => {
    const env: NodeJS.ProcessEnv = { HOME: "/h", PATH: "/usr/bin" };
    let shell = "";
    syncShellPath(env, (sh) => {
      shell = sh;
      throw new Error("spawnSync /bin/zsh ETIMEDOUT");
    });
    expect(shell).toBe("/bin/zsh");
    expect(env.PATH).toBe("/usr/bin:/h/.local/bin:/opt/homebrew/bin:/usr/local/bin");
  });
  it("reads null when the output has no markers", () => {
    expect(readLoginShellPath("/bin/sh", () => "oops")).toBeNull();
  });
});
