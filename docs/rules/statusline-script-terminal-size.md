---
type: Reference
description: The ESLint rule claude/statusline-script-terminal-size, which reports a statusLine script in the repository that calls tput cols, because Claude Code captures the output of the script. It is off in recommended.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `statusline-script-terminal-size`

Read `COLUMNS` and `LINES` in a status line script, not `tput cols`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. It is a heuristic. It reads a script as text. `strict` turns it on at
`warn`.

## Rule details

Claude Code captures the output of your script. It does not connect the script to the terminal. So `tput
cols` cannot read the terminal size from inside the script. The script must read the environment variables
`COLUMNS` and `LINES`, which Claude Code sets to the size of the terminal.[^size]

The rule finds the script in `statusLine.command` and reads it from the repository. It reports the command
when a line of the script calls `tput cols`. A line that starts with `#` is a comment.

Only two words of the command can name a script: the program, and the first argument when the program is
an interpreter. A quote joins to the characters that follow it, so `"$CLAUDE_PROJECT_DIR"/x.sh` is one word. The interpreters are `bash`, `sh`,
`zsh`, `node`, `python`, `python3`, `deno`, `bun`, `pwsh`, `powershell`, `ruby` and `perl`. A word names a
script in two cases.

- It starts with `${CLAUDE_PROJECT_DIR}/` or `$CLAUDE_PROJECT_DIR/`.
- It is the program, it has a `/`, and it does not start with `/`. A project file resolves it from the
  folder that holds `.claude/`. A managed file has no project, so it has no such word. For a managed file, `${CLAUDE_PROJECT_DIR}` is the repository root.

### What the rule does not check

- A script that is missing, that is out of the repository, or that the rule cannot read. The rule cannot
  read a link out of the repository, a link to nothing, or a file with no read access (ADR 001, Decision 14).
- A word that has one of these characters: `$`, `*`, `?`, `[`, `]`, `{`, `}`, `~`, `:`, `=`, `!`, `#`, a
  backtick or a backslash. The rule cannot resolve such a word.
- A comment after code, such as `x=1 # tput cols`. The rule reports it as a call.
- A fallback such as `${COLUMNS:-$(tput cols)}`. The rule reports it as a call.
- `tput lines`, and the width detection of a language. The page names only `tput cols` as a command.
- `subagentStatusLine` and `fileSuggestion`.
- A hidden file in `managed-settings.d/`, which Claude Code ignores.

Fail, when `.claude/statusline.sh` has the line `width=$(tput cols)`:

```json
{
  "statusLine": {
    "type": "command",
    "command": ".claude/statusline.sh"
  }
}
```

Pass, when the script reads `${COLUMNS}`.

## Sources

[^size]: [Customize your status line: Size output to the terminal](https://code.claude.com/docs/en/statusline#size-output-to-the-terminal)
