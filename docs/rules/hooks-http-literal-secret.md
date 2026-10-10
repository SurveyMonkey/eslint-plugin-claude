---
type: Reference
description: The ESLint rule claude/hooks-http-literal-secret, which reports a literal credential in a header of an http hook, where a variable reference keeps the secret out of the repository.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-http-literal-secret`

Use a variable and not a literal credential in a header of an http hook.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | security | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

The `headers` of an `http` hook support `$VAR_NAME` and `${VAR_NAME}`. Claude Code replaces a reference with the
value of the variable only when `allowedEnvVars` lists it.[^http] The example of the docs sets
`"Authorization": "Bearer $MY_TOKEN"`. A literal token in a header is a secret in a file that the repository
holds.

The rule reads each header of an `http` handler. It reports a header when all of these are true:

- The header name holds `auth`, `token`, `secret`, `password`, `api-key`, `api_key`, `apikey` or `credential`, in
  any letter case. This list is the choice of the plugin. `Authorization` is the name in it that the docs use.
- The value is a string with no `$VAR` or `${VAR}` reference.
- After the scheme word (`Bearer`, `Basic` or `Token`), some text is left, and that text is not a value that
  cannot be a secret: a Boolean word (`true`, `false`, `yes`, `no`, `on`, `off`), `none`, `null` or a plain integer.

The rule reports at the value. The message names the header and never holds the value.

[`hooks-http-env-allowlist`](hooks-http-env-allowlist.md) reads the references. This rule reads the literals. A
value with a reference gets no report from this rule.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, and no plugin agent.

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
            "headers": { "Authorization": "Bearer abc123def456" }
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

[^http]: [Hooks reference: HTTP hook fields](https://code.claude.com/docs/en/hooks#http-hook-fields)
