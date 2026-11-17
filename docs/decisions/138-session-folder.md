# 138: An agent's project is its session folder

- The sidebar puts an agent under the project of its session folder: `hc get --json`
  `foreground.cwd`, the folder of the agent program itself. A `cd` in a tool shell
  moves the terminal's `cwd`, not this folder. Without a `foreground.cwd`, the
  terminal's `cwd` is used.
- The Herdr app groups by its space (hc `where`). For the agents of issue 136,
  `foreground.cwd` gives the same project. The space name is a Herdr name, not a
  folder, so this app does not use it.
- A live hc terminal with a parent is a worker also before it has a `status`, as
  herdr-contr-spaces `workers()`. It shows only under a listed parent.
