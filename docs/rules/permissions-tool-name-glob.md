---
type: Reference
description: The ESLint rule claude/permissions-tool-name-glob, which reports a glob in the tool name of an allow rule unless it follows a literal mcp__<server>__ prefix, because Claude Code skips the rule.
owner: brianespinosa
created: 2026-10-01
related_issues: [15]
stale_after: 2027-03-29
generated:
  by: claude-code
  at: 2026-10-01T00:00:00Z
---

# `permissions-tool-name-glob`

Put a tool-name glob in an allow rule only after mcp__<server>__.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/SKILL.md`, `**/commands/**/*.md` |

The rule also lints the managed settings files: `managed-settings.json` and each `managed-settings.d/*.json` drop-in. It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

A deny or ask rule accepts a glob in the tool-name position, such as `"*"` or `"mcp__*"`. An allow rule accepts a glob
only after a literal `mcp__<server>__` prefix, and the server segment must have no glob.[^wildcards][^allow] Claude Code skips an allow
glob such as `"*"`, `"B*"` or `"mcp__*"` with a warning. It approves nothing.

The rule reads `permissions.allow`. It reports a tool name that has `*` and does not start with `mcp__<server>__`, where
`<server>` is not empty and has no `*`. It does not read `permissions.ask` or `permissions.deny`, because the docs set no limit on
a glob there.

The rule skips a string that does not parse. [`permissions-rule-syntax`](permissions-rule-syntax.md) reports it.

## Skill and command files

The rule also reads a skill file (`SKILL.md`) and a command file. In the frontmatter, `allowed-tools` is an allow list,
and `disallowed-tools` is a deny list.[^skill][^fields] Each field takes a space- or comma-separated string, or a YAML
list. A space inside parentheses does not split a rule. The rule reports at the entry. It reads no other frontmatter
field. It skips a field that is neither a string nor a list. It does not read the `tools` field of a subagent.
[`agent-tools-known`](agent-tools-known.md) checks that field.

In a skill, the rule reads `allowed-tools` only, because that field is the allow list.

Fail:

```json
{ "permissions": { "allow": ["mcp__*", "B*", "mcp__*__get"] } }
```

Fail, in a skill:

```yaml
---
name: example
allowed-tools: mcp__* B*
---
```

Pass:

```json
{ "permissions": { "allow": ["mcp__puppeteer__*", "mcp__github__get_*"], "deny": ["mcp__*"] } }
```

## Sources

[^wildcards]: [Configure permissions: Tool name wildcards](https://code.claude.com/docs/en/permissions#tool-name-wildcards)
[^allow]: [All settings: permissions.allow](https://code.claude.com/docs/en/settings-reference#permissions-allow)
[^skill]: [Extend Claude with skills: Pre-approve tools for a skill](https://code.claude.com/docs/en/skills#pre-approve-tools-for-a-skill)
[^fields]: [Extend Claude with skills: Frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)
