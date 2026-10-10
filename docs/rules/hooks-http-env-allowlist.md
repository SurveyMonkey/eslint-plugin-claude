---
type: Reference
description: The ESLint rule claude/hooks-http-env-allowlist, which reports an environment variable in a header of an http hook that the allowedEnvVars list of the same hook does not name, because Claude Code then sends an empty string.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-http-env-allowlist`

List each environment variable of an http hook header in `allowedEnvVars`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

The `headers` of an `http` hook can hold `$VAR_NAME` or `${VAR_NAME}`. Claude Code resolves only the
variables that the `allowedEnvVars` list of the same hook names. It replaces a reference to any other
variable with an empty string. Without `allowedEnvVars`, no interpolation works.[^fields]

The rule reports each variable of a header value that `allowedEnvVars` does not list. It reports
once for each variable in each header value, at the value. The message names the variable and the
header. A name is case-sensitive, and `$MY_TOKEN_2` is not `MY_TOKEN`.

The rule does not read the settings key `httpHookAllowedEnvVars`. That key sets an outer limit:
a hook can use a variable only if its own list and the key both name it. Arrays of that key merge
across settings files.[^key] A user file or a managed file out of the repository can add a
variable. So a list in a repository file is never the final list, and the rule makes no report
from it (ADR 001, Decision 14). It reads the list of the hook only. That list is in the same
handler, so it is final.

The rule makes no report in these cases. `hooks-config-schema` reports the wrong type.

- `headers` is not an object, or a header value is not a string.
- `allowedEnvVars` is set and is not an array. An item that is not a string names no variable.
- The handler is not of type `http`.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden
file in `managed-settings.d/`, and no plugin agent, because Claude Code ignores the `hooks` field
there.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "http",
            "url": "https://hooks.example.com/pre-tool-use",
            "headers": { "Authorization": "Bearer $MY_TOKEN" }
          }
        ]
      }
    ]
  }
}
```

Pass:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "http",
            "url": "https://hooks.example.com/pre-tool-use",
            "headers": { "Authorization": "Bearer $MY_TOKEN" },
            "allowedEnvVars": ["MY_TOKEN"]
          }
        ]
      }
    ]
  }
}
```

## Sources

[^fields]: [Hooks reference: HTTP hook fields](https://code.claude.com/docs/en/hooks#http-hook-fields)
[^key]: [Settings reference: httpHookAllowedEnvVars](https://code.claude.com/docs/en/settings-reference#httphookallowedenvvars)
