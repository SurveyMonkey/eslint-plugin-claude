---
type: Reference
description: The ESLint rule claude/settings-env-subprocess-scrub, which reports a shared .claude/settings.json whose env does not set CLAUDE_CODE_SUBPROCESS_ENV_SCRUB to an on value. It is off in recommended.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-env-subprocess-scrub`

Set `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` to `1` in the shared settings file.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | security | `**/.claude/settings.json` |

The rule is `off` in `recommended`. It is a heuristic. A team can set the variable in a managed file or
in a shell. `strict` turns it on at `warn`.

## Rule details

`CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` strips credentials from the environment of the subprocesses that Claude
Code starts. These are Bash commands, hooks and stdio MCP servers.[^vars] The scrub finds a credential by
its variable name or by its value.[^scrub]

The rule reports a `.claude/settings.json` file in two cases.

- The `env` block does not set the variable. The report is on the whole file.
- The `env` block sets the variable to a value that is not on. The report is on the value.

An on value is `1`, `true`, `yes` or `on`, with any letter case.[^vars]

### What the rule does not check

- A value that is not a string. `settings-env-value-format` reports it.
- `.claude/settings.local.json`. It belongs to one user.
- A managed file. A policy for an organization can set the variable there, and the rule does not
  read a file other than the linted file.
- A variable that you set in your shell, or in a CI workflow. `claude-code-action` sets it when
  `allowed_non_write_users` is set.[^vars]

Fail:

```json
{
  "env": {
    "MY_VARIABLE": "1"
  }
}
```

Pass:

```json
{
  "env": {
    "CLAUDE_CODE_SUBPROCESS_ENV_SCRUB": "1"
  }
}
```

## Sources

[^vars]: [Environment variables: Variables](https://code.claude.com/docs/en/env-vars#variables)
[^scrub]: [Environment variables: What the subprocess environment scrub removes](https://code.claude.com/docs/en/env-vars#what-the-subprocess-environment-scrub-removes)
