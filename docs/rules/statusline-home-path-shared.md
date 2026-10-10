---
type: Reference
description: The ESLint rule claude/statusline-home-path-shared, which reports a statusLine command in the shared .claude/settings.json that points at ~/.claude/, a folder of one user. It is off in recommended.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `statusline-home-path-shared`

Do not point the shared `statusLine` command at the home `.claude` folder.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | portability | `**/.claude/settings.json` |

The rule is `off` in `recommended`. It is a heuristic. A team can put the script in the home folder of
each person. `strict` turns it on at `warn`.

## Rule details

The `/statusline` command writes a script to `~/.claude/` and sets `statusLine.command` to its path.[^command]
The status line page shows `~/.claude/statusline.sh` as the example command.[^manual] The home folder
belongs to one user. A person who opens the repository has no such script, and the status line fails.

The rule reports a `statusLine.command` string with the text `~/.claude/`. The report is on the command.
The rule reads the text of the command and reads no file.

`settings-committed-helper-command` reports each shell command key in the shared file. This rule adds
the finding that the path is in a home folder.

### What the rule does not check

- `$HOME/.claude/` and other spellings of the home folder. The page shows the form `~/.claude/` only.
- `subagentStatusLine` and `fileSuggestion`.
- `.claude/settings.local.json`. The local file is for one user.
- A managed file.

Fail:

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh"
  }
}
```

Pass: commit the script, and use a path in the repository.

```json
{
  "statusLine": {
    "type": "command",
    "command": "${CLAUDE_PROJECT_DIR}/.claude/statusline.sh"
  }
}
```

## Sources

[^command]: [Customize your status line: Use the /statusline command](https://code.claude.com/docs/en/statusline#use-the-statusline-command)
[^manual]: [Customize your status line: Manually configure a status line](https://code.claude.com/docs/en/statusline#manually-configure-a-status-line)
