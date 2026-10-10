---
type: Reference
description: The ESLint rule claude/settings-env-numeric-spelling, which reports an env value in scientific notation or with underscore digit separators, such as 1e6 or 64_000, which Claude Code before v2.1.211 reads as a much smaller number.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-env-numeric-spelling`

Write a number in the `env` block of a settings file in plain digits.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

A numeric variable, such as a timeout or a token budget, accepts scientific notation and digit
separators. Claude Code reads `2e3` as 2000 and `64_000` as 64000. Before v2.1.211, these spellings
could set a much smaller value. The env vars reference gives an example: `1e6` set a timeout to 1.[^spelling]

The rule reports a string value that has one of these two shapes:

- Digits, an optional fraction, an exponent mark `e` or `E`, an optional sign, and digits. Examples:
  `1e6`, `2.5E+3`.
- Groups of digits that underscores join. Examples: `64_000`, `1_000_000`.

The report is on the value. When a file has two keys of one name, the rule reads the last, as
`JSON.parse` does.

### Option

A fault shows only on a client older than v2.1.211. The rule cannot know which clients a team
runs. So it reports nothing until the option `minVersion` names the oldest client of the team. It
reports when that version is below 2.1.211. `recommended` and `strict` set no option, so the rule
is off there until a team sets `minVersion`.

```json
{ "claude/settings-env-numeric-spelling": ["warn", { "minVersion": "2.1.200" }] }
```

### What the rule does not check

- The name of the variable. The docs name no list of numeric variables, so the rule reads the shape
  of the value. A text value that has such a shape gets a report.
- A variable that has a form in `settings-env-value-format` and rejects the value, such as
  `CLAUDE_CODE_WEBFETCH_CACHE_TTL_MS` with `9e5`. That rule reports it, so the fault gets one
  report. The env vars reference says that these variables take plain digits only.
- A credential variable.
- A value that is not a string, and a value with a leading sign, a space, or a comma.
- A hidden drop-in, which Claude Code ignores.

Fail:

```json
{
  "env": {
    "API_TIMEOUT_MS": "1e6",
    "MAX_THINKING_TOKENS": "64_000"
  }
}
```

Pass:

```json
{
  "env": {
    "API_TIMEOUT_MS": "1000000",
    "MAX_THINKING_TOKENS": "64000"
  }
}
```

## Sources

[^spelling]: [Environment variables: Variables](https://code.claude.com/docs/en/env-vars#variables)
