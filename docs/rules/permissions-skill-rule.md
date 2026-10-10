---
type: Reference
description: The ESLint rule claude/permissions-skill-rule, which reports a Skill allow rule in settings or in the allowed-tools of a skill, such as Skill(anthropic *), whose prefix stops short of the anthropic-skills namespace and so does not cover the synced skills inside it.
owner: brianespinosa
created: 2026-10-02
related_issues: [15, 33]
stale_after: 2027-03-30
generated:
  by: claude-code
  at: 2026-10-02T00:00:00Z
---

# `permissions-skill-rule`

Name the `anthropic-skills` namespace in a `Skill` allow rule for a synced skill.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/SKILL.md`, `**/commands/**/*.md` |

The rule also lints the managed settings files: `managed-settings.json` and each `managed-settings.d/*.json` drop-in. It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

A `Skill` rule is `Skill`, `Skill(name)` for an exact match, or `Skill(name *)` for a prefix match.[^access] Claude Code
reserves the `anthropic-skills` namespace for the skills that it syncs from claude.ai. In an `allow` rule, a prefix outside
the namespace does not match the names inside it. The docs give an example: `Skill(anthropic *)` does not cover
`anthropic-skills:pdf`.[^access] To approve every synced skill, write `Skill(anthropic-skills *)`.

The rule reports an `allow` rule of the form `Skill(<prefix> *)` when the prefix:

- starts with `anthropic`
- is a start of `anthropic-skills`, and is not `anthropic-skills`

The rule reports `Skill(anthropic *)`, `Skill(anthropic- *)` and `Skill(anthropic-skill *)`. It does not report
`Skill(anthropic-skills *)` or `Skill(anthropic-skills:pdf)`. A shorter prefix such as `a` is a common start for the name
of a local skill, so the rule skips it.

The docs state the namespace limit for `allow` rules. The rule does not read `ask` and `deny`. A `deny` rule can block a
skill by an alias or an unqualified name, as the same section says. The docs state no other fault in the form of a `Skill`
rule, so the rule checks no other form.

The rule reads `permissions.allow` of a settings file, and `allowed-tools` of a skill or command file. It reads a skill
field as the grammar rules do: a space- or comma-separated string, or a YAML list. It does not read `disallowed-tools`,
because that field is a deny list. The rule skips a string that does not parse.
[`permissions-rule-syntax`](permissions-rule-syntax.md) reports it.

Fail:

```json
{ "permissions": { "allow": ["Skill(anthropic *)"] } }
```

```markdown
---
allowed-tools: Skill(anthropic *)
---
```

Pass:

```json
{ "permissions": { "allow": ["Skill(anthropic-skills *)", "Skill(commit)"] } }
```

## Options

None.

## Sources

[^access]: [Extend Claude with skills: Restrict Claude's skill access](https://code.claude.com/docs/en/skills#restrict-claudes-skill-access)
