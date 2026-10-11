---
type: Reference
description: The ESLint rule claude/settings-env-context-cost, which reports FORCE_PROMPT_CACHING_5M set on, and ENABLE_TOOL_SEARCH set to a false value, in the shared project settings file. It is off in recommended.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-env-context-cost`

Do not set an `env` variable that raises the context cost in the shared settings file.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | limit | `**/.claude/settings.json` |

The rule is `off` in `recommended`. It is a heuristic. `strict` turns it on at `warn`. The rule
compares no number, so it has no threshold option.

## Rule details

The rule reports two variables of `env`. The report is on the variable name.

- `FORCE_PROMPT_CACHING_5M` set to `1`, `true`, `yes` or `on`. It forces the 5-minute prompt cache
  lifetime. It overrides the variables and the settings that choose a longer lifetime. The prompt
  caching page names it as a way to debug the cache.[^ttl] In the shared file it moves every user of the
  repository to the shorter lifetime.
- `ENABLE_TOOL_SEARCH` set to `false`, `0`, `no` or `off`. Tool search defers the MCP tools by
  default. The value `false` loads all tools upfront.[^vars] Tools that load upfront fill the
  context. A change of the tool set also invalidates the prompt cache.[^mcp]

The letter case of a value does not matter. The rule makes no report in these cases:

- The value is not a string. `settings-env-value-format` reports it.
- The value of `FORCE_PROMPT_CACHING_5M` is off or empty.
- The value of `ENABLE_TOOL_SEARCH` is `true`, `auto`, `auto:N` or empty.

### What the rule does not check

- The variables that turn prompt caching off. `settings-env-prompt-caching-off` owns them.
- `.claude/settings.local.json` and the managed files. A personal file or a policy can set these
  variables on purpose.

Fail:

```json
{
  "env": {
    "ENABLE_TOOL_SEARCH": "false"
  }
}
```

Pass: remove the variable, or set it in your shell for one debug session.

## Sources

[^ttl]: [How Claude Code uses prompt caching: Choose the TTL yourself](https://code.claude.com/docs/en/prompt-caching#choose-the-ttl-yourself)
[^mcp]: [How Claude Code uses prompt caching: Connecting or removing an MCP server](https://code.claude.com/docs/en/prompt-caching#connecting-or-removing-an-mcp-server)
[^vars]: [Environment variables: Variables](https://code.claude.com/docs/en/env-vars#variables)
