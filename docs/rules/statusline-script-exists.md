---
type: Reference
description: The ESLint rule claude/statusline-script-exists, which reports a script in the command of statusLine, subagentStatusLine or fileSuggestion when it does not exist in the repository, or when its git index mode is 100644 and not 100755.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `statusline-script-exists`

Name a status line script that exists and is executable.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

The `command` of `statusLine` points to a script path or holds an inline shell command.[^manual] The
same shape is in `subagentStatusLine`[^subagent] and `fileSuggestion`.[^gates] When the script is
not executable, the status line does not appear.[^trouble] A script that is not there fails in the
same way.

The rule reads the `command` string of the three keys, and finds a script path in these words:

- **A word that starts with `${CLAUDE_PROJECT_DIR}`.** The `$CLAUDE_PROJECT_DIR` form with no braces
  counts too. The word can be the program or an argument.
- **The program, when it is a path from the project.** The words `.claude/statusline.sh` and
  `./tools/statusline.sh` count. A bare name is a search on the `PATH`, so it does not count.

The rule reports `missing` when the script is not in the repository. It reports `notExecutable`
when the program is a script with git mode `100644`. A script that is an argument, as in
`bash ${CLAUDE_PROJECT_DIR}/line.sh`, needs no bit.

The project is the parent of the `.claude/` directory. A managed settings file applies in any
project, so the rule resolves `${CLAUDE_PROJECT_DIR}` from the root of the repository that holds the
file. A path from the project does not resolve in a managed file. The rule reads `command` and does
not check `type`, because other rules check the shape of the key.

The executable bit is the git index mode, for the same reasons as in
[`hooks-script-executable`](hooks-script-executable.md):

- The index can keep `100755` while the disk shows `644`. The team gets the index mode when it
  clones the repository.
- With `core.fileMode=false`, git does not see the disk mode.

The rule makes no report in these cases:

- **The command is not a repository path.** A path in `~`, an absolute path, a bare name, a glob,
  and a word with another variable are not read. An inline command such as `jq -r .model` names
  no script. The target of a redirect is not a script.
- **The path is out of the repository**, or a link hides it (ADR 001, Decision 14). A link to a
  file in the repository takes the mode of that file.
- **The rule cannot read the index.** There is no `.git` entry at or above the file, `git` is not
  installed, or a `git` command fails. The rule still reports a script that is not there. A script
  that git does not track gets no `notExecutable` report.
- **The file is a hidden drop-in** in `managed-settings.d/`, which Claude Code ignores.

When a key appears twice, the rule reads the last, as `JSON.parse` does.

Fail:

```json
{ "statusLine": { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/statusline.sh" } }
```

in `.claude/settings.json`, when there is no `.claude/statusline.sh`, or git tracks it with mode
`100644`.

Pass: the same file, with the script tracked with mode `100755`.

## Options

None.

## Sources

[^manual]: [Customize your status line: Manually configure a status line](https://code.claude.com/docs/en/statusline#manually-configure-a-status-line)
[^trouble]: [Customize your status line: Troubleshooting](https://code.claude.com/docs/en/statusline#troubleshooting)
[^subagent]: [Customize your status line: Subagent status lines](https://code.claude.com/docs/en/statusline#subagent-status-lines)
[^gates]: [All settings: Status line and file suggestion gates](https://code.claude.com/docs/en/settings-reference#status-line-and-file-suggestion-gates)
