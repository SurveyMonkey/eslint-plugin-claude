---
type: Reference
description: The ESLint rule claude/permissions-end-conversation, which reports a deny or ask rule that names EndConversation, because the tool never prompts and a deny rule cannot remove it while any other tool remains.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-end-conversation`

Do not name `EndConversation` in a deny or ask rule.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule also lints the managed settings files: `managed-settings.json` and each `managed-settings.d/*.json` drop-in.
It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

The `EndConversation` tool never prompts for permission. While any other tool remains, you cannot block it. Deny and ask
rules that name `EndConversation` have no effect.[^behavior] The exemption is deliberate. A safeguard of this kind holds
only if the session it applies to cannot turn it off.[^behavior] Bare-name removal applies to every tool except
`EndConversation`.[^manage] The settings reference says the same of deny rules.[^deny]

The rule reports a `deny` or `ask` entry that is the bare name `EndConversation`. The message names the list.

The rule is silent for these entries:

- A glob such as `*`. When the deny rules remove every other tool and also match `EndConversation`, as `"*"` does, Claude
  Code removes it too.[^behavior] A glob ask rule never prompts for it.[^globs] A file cannot show whether any other tool
  remains. So the rule reads the exact name only.
- A rule with a specifier, as in `EndConversation(*)`. [`permissions-specifier-unsupported`](permissions-specifier-unsupported.md)
  reports it.
- A name that is spelled otherwise. [`permissions-unknown-tool`](permissions-unknown-tool.md) reports it.
- An `allow` rule. The docs say that an allow rule that names `EndConversation` keeps the tool when every other
  tool is removed.[^behavior]

The rule reads the last of two keys of one name, as `JSON.parse` does. It reads `permissions.deny` and `permissions.ask`
of a settings file. It reads no skill file. The rule skips a string that does not parse.
[`permissions-rule-syntax`](permissions-rule-syntax.md) reports it.

Fail:

```json
{ "permissions": { "deny": ["EndConversation"] } }
```

Pass:

```json
{ "permissions": { "deny": ["Bash(curl *)"] } }
```

## Options

None.

## Sources

[^behavior]: [Tools reference: EndConversation tool behavior](https://code.claude.com/docs/en/tools-reference#endconversation-tool-behavior)
[^manage]: [Configure permissions: Manage permissions](https://code.claude.com/docs/en/permissions#manage-permissions)
[^globs]: [Configure permissions: Tool name wildcards](https://code.claude.com/docs/en/permissions#tool-name-wildcards)
[^deny]: [All settings: permissions.deny](https://code.claude.com/docs/en/settings-reference#permissionsdeny)
