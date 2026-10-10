---
type: Reference
description: The ESLint rule claude/hooks-command-path-variable, which reports a plugin command hook that runs a path from the working directory, because a plugin must reach its files through CLAUDE_PLUGIN_ROOT.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-command-path-variable`

Reach the files of a plugin hook through the CLAUDE_PLUGIN_ROOT variable.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | portability | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

A plugin does not know where Claude Code installs it. The docs say to refer to its files through
`${CLAUDE_PLUGIN_ROOT}`, "rather than fixed paths".[^paths] The hooks reference shows the variable in the example
of a plugin script.[^scripts] The placeholders work "regardless of the working directory when the hook runs".[^scripts] The guide tells you to use absolute paths or a variable when a hook fails with "command not
found".[^guide]

The rule reads the `command` of a command hook in a plugin `hooks/hooks.json`, and in the frontmatter of a skill
in a plugin. It reports a path that starts in the working directory. It reports at the `command` value, once for
each handler.

A path starts in the working directory when it has a slash and does not start with a slash, a variable, `~` or a
drive letter. The rule checks the program of each simple command, such as `./scripts/a.sh`. It checks the first
argument that is not a flag, and stops at `-c` or `-e`, when the program is `bash`, `sh`, `zsh`, `node`, `python`, `python3`, `ruby`,
`pwsh` or `powershell`. It reads shell form and exec form. It stops at a `cd`, `pushd` or `Set-Location`, because a path after one can
resolve inside the plugin.

The rule is `off` in `recommended`, because it is a heuristic. It cannot see where a file really is.

The rule makes no report in these cases:

- The hook is in a project file: a settings file, a project skill or a project agent. The subagents page shows
  `./scripts/setup-db-connection.sh` in a project settings file as a working hook.[^subagents]
  The hooks reference gives `${CLAUDE_PROJECT_DIR}` as the way to reach project scripts, but it does not call the
  relative path a fault.
- The path is absolute, starts with `~` or starts with a variable. The hooks reference tells you to use absolute
  paths.[^practices] A system program such as `/usr/bin/jq` is not a bundled file.
- The program is a bare name, such as `jq`. It has no slash, so the rule does not read it as a path.
- A relative path is an argument of a program that is not in the list above, such as `rm -rf ./tmp`.

Fail, in `hooks/hooks.json` of a plugin:

```json
{
  "hooks": {
    "PostToolUse": [{ "hooks": [{ "type": "command", "command": "./scripts/format.sh" }] }]
  }
}
```

Pass:

```json
{
  "hooks": {
    "PostToolUse": [
      { "hooks": [{ "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/scripts/format.sh", "args": [] }] }
    ]
  }
}
```

## Sources

[^paths]: [Add components to a plugin: Reference plugin paths and store data](https://code.claude.com/docs/en/plugins/components#path-variables-and-persistent-data)
[^scripts]: [Hooks reference: Reference scripts by path](https://code.claude.com/docs/en/hooks#reference-scripts-by-path)
[^guide]: [Automate actions with hooks: Hook error in output](https://code.claude.com/docs/en/hooks-guide#hook-error-in-output)
[^practices]: [Hooks reference: Security best practices](https://code.claude.com/docs/en/hooks#security-best-practices)
[^subagents]: [Subagents: Project-level hooks for subagent events](https://code.claude.com/docs/en/sub-agents#project-level-hooks-for-subagent-events)
