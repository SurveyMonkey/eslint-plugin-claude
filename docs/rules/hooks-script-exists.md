---
type: Reference
description: The ESLint rule claude/hooks-script-exists, which reports a repository script that a hook command names with the project or plugin variable, or by a path from the project, when the script does not exist.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-script-exists`

Name a hook script that exists.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/hooks/hooks.json`, `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

A hook whose script is not there cannot start. Claude Code shows a non-blocking error, and the
hook never runs.[^exit][^error] A mistyped path in a settings file is the usual cause.

The rule reads each command hook (`type: "command"`) in the `hooks` key of the file. Hooks in
skill and agent frontmatter are not read. The rule finds a script path in these words of the
command:

- **A word that starts with a path variable.** `${CLAUDE_PROJECT_DIR}` is the project root.
  `${CLAUDE_PLUGIN_ROOT}` is the plugin directory.[^paths] The `$CLAUDE_PROJECT_DIR` form with
  no braces counts too. The word can be the program or an argument, as in
  `node "${CLAUDE_PROJECT_DIR}/.claude/hooks/check.js"`.
- **The program, when it is a path from the project.** The words `.claude/hooks/check.sh` and
  `./tools/check.sh` count. A bare name such as `check.sh` is a search on the `PATH`, so it does
  not count.

In the exec form, `command` is the program and each `args` element is one word.[^exec] In the shell
form, the rule splits `command` the way a shell does. It follows quotes and the operators `&&`,
`;` and `|`. It leaves out the target of a redirect (`> "${CLAUDE_PROJECT_DIR}/out.log"`).

Where each variable resolves:

- **`hooks/hooks.json` in a plugin.** `${CLAUDE_PLUGIN_ROOT}` resolves to the plugin root. The
  project variable and a path from the project do not resolve, because the project is the
  project of the user.
- **A project or local settings file.** The project is the parent of the `.claude/` directory.
  `${CLAUDE_PLUGIN_ROOT}` does not resolve.
- **A managed settings file.** Claude Code applies it in any project. The rule resolves
  `${CLAUDE_PROJECT_DIR}` from the root of the repository that holds the file. A path from the
  project does not resolve.

The rule makes no report in these cases:

- **The word is not a repository path.** An absolute path, a path in `~`, a word with another
  variable, a glob, a Windows separator or a shell expansion cannot be resolved.
- **The path is out of the repository.** A rule reads no file out of the repository (ADR 001,
  Decision 14). In a plugin, `${CLAUDE_PLUGIN_ROOT}/../x` is out of the plugin too, because
  Claude Code copies the plugin.
- **A link hides the path.** A link on the path is dangling or leads out of the repository.
- **The rule cannot read a directory on the path.**
- **`hooks/hooks.json` is in no plugin.** The file must be in a directory with
  `.claude-plugin/plugin.json`.
- **The file is a hidden drop-in** in `managed-settings.d/`, which Claude Code ignores.

When a file has two `hooks` keys, the rule reads the last, as `JSON.parse` does. The rule
`hooks-script-executable` checks the mode of a script that is the program.

Fail:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/check.sh" }
        ]
      }
    ]
  }
}
```

in `.claude/settings.json`, with no `.claude/hooks/check.sh`.

Pass: the same file, with the script in `.claude/hooks/`.

## Options

None.

## Sources

[^exit]: [Hooks reference: Other exit codes](https://code.claude.com/docs/en/hooks#other-exit-codes)
[^paths]: [Hooks reference: Reference scripts by path](https://code.claude.com/docs/en/hooks#reference-scripts-by-path)
[^exec]: [Hooks reference: Exec form and shell form](https://code.claude.com/docs/en/hooks#exec-form-and-shell-form)
[^error]: [Automate actions with hooks: Hook error in output](https://code.claude.com/docs/en/hooks-guide#hook-error-in-output)
