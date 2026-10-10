---
type: Reference
description: The ESLint rule claude/settings-env-prompt-caching-off, which reports DISABLE_PROMPT_CACHING or a per-model DISABLE_PROMPT_CACHING variable set on in the env block of the shared .claude/settings.json.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-env-prompt-caching-off`

Do not turn prompt caching off from the shared settings file.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude/settings.json` |

## Rule details

Prompt caching makes Claude Code faster and more cost-efficient.[^caching] Five variables turn
it off when set to `1`:[^disable] `DISABLE_PROMPT_CACHING`, `DISABLE_PROMPT_CACHING_FABLE`,
`DISABLE_PROMPT_CACHING_HAIKU`, `DISABLE_PROMPT_CACHING_OPUS` and `DISABLE_PROMPT_CACHING_SONNET`.
The page says that it is useful to turn caching off when you debug caching with a model or
provider, and that you leave caching on for normal use.[^disable]

A variable in `.claude/settings.json` applies to everyone who opens the repository. The rule
reports a variable of the list with a value that turns a variable on: `1`, `true`, `yes` or
`on`, with any letter case.[^vars] The report is on the variable name. When a file has two keys of one
name, the rule reads the last, as `JSON.parse` does.

### What the rule does not check

- A value of `0`, another off value, or `""`. They leave caching on.
- A value that is not a string. `settings-env-value-format` reports it.
- A variable that the page does not list.
- `.claude/settings.local.json`. It belongs to one user, who may debug caching.
- A managed file. The page names the `env` block of managed settings as the place for a caching
  policy across an organization.[^disable]
- A user settings file, or a file passed with `--settings`. They are not in a repository.

Fail:

```json
{
  "env": {
    "DISABLE_PROMPT_CACHING": "1"
  }
}
```

Pass:

```json
{
  "env": {
    "CLAUDE_CODE_PROMPT_CACHE_TTL": "1h"
  }
}
```

## Sources

[^caching]: [How Claude Code uses prompt caching](https://code.claude.com/docs/en/prompt-caching)
[^disable]: [How Claude Code uses prompt caching: Disable prompt caching](https://code.claude.com/docs/en/prompt-caching#disable-prompt-caching)
[^vars]: [Environment variables: Variables](https://code.claude.com/docs/en/env-vars#variables)
