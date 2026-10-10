---
type: Reference
description: The ESLint rule claude/permissions-rule-syntax, which reports a string in permissions.allow, ask or deny, or an entry in skill allowed-tools or disallowed-tools, that is not the form Tool or Tool(specifier), because Claude Code skips it.
owner: brianespinosa
created: 2026-10-01
related_issues: [15]
stale_after: 2027-03-29
generated:
  by: claude-code
  at: 2026-10-01T00:00:00Z
---

# `permissions-rule-syntax`

Write each permission rule as `Tool` or `Tool(specifier)`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/SKILL.md`, `**/commands/**/*.md` |

The rule also lints the managed settings files: `managed-settings.json` and each `managed-settings.d/*.json` drop-in. It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

A permission rule is `Tool` or `Tool(specifier)`.[^syntax][^reference] Claude Code skips a string that has
another form.[^broken][^malformed] The rule reads each string in `permissions.allow`, `permissions.ask` and
`permissions.deny`. It reports at the string. It ignores an entry that is not a string.

The rule reports these faults:

- The tool name is empty, as in `(npm run *)`.
- A parenthesis is not balanced, as in `Bash(npm run build` or `Bash)`.
- Text follows the final parenthesis, as in `Bash(npm run build) --watch`.
- The string holds a NUL byte. Claude Code matches nothing with such a rule.

Parentheses inside a specifier are literal, so `Edit(./Finance (2024)/**)` is valid.[^syntax] The
tool name ends at the first `(`. The specifier ends at the last `)`. The rule does not trim the
string.

This is the only rule of the permission grammar group that reports a string that does not parse. The
other six rules skip it. You see a fault of the tool or of the specifier only after you fix
the syntax.

## Skill and command files

The rule also reads a skill file (`SKILL.md`) and a command file. In the frontmatter, `allowed-tools` is an allow list,
and `disallowed-tools` is a deny list.[^skill][^fields] Each field takes a space- or comma-separated string, or a YAML
list. A space inside parentheses does not split a rule. The rule reports at the entry. It reads no other frontmatter
field. It skips a field that is neither a string nor a list. It does not read the `tools` field of a subagent.
[`agent-tools-known`](agent-tools-known.md) checks that field.

This rule reports a field entry that does not parse. The other six rules skip it.

Fail:

```json
{ "permissions": { "allow": ["Bash(npm run build", "(npm run *)"] } }
```

Fail, in a skill:

```yaml
---
name: example
allowed-tools: Bash(npm run build
---
```

Pass:

```json
{ "permissions": { "allow": ["Bash(npm run build)", "Bash"] } }
```

## Sources

[^syntax]: [Configure permissions: Permission rule syntax](https://code.claude.com/docs/en/permissions#permission-rule-syntax)
[^reference]: [All settings: Permission rule syntax](https://code.claude.com/docs/en/settings-reference#permission-rule-syntax)
[^broken]: [Settings files and precedence: Fix a broken settings file](https://code.claude.com/docs/en/settings#fix-a-broken-settings-file)
[^malformed]: [Error reference: Malformed Tool(content) rule](https://code.claude.com/docs/en/errors#malformed-tool-content-rule)
[^skill]: [Extend Claude with skills: Pre-approve tools for a skill](https://code.claude.com/docs/en/skills#pre-approve-tools-for-a-skill)
[^fields]: [Extend Claude with skills: Frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)
