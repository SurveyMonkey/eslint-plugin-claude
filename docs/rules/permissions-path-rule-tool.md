---
type: Reference
description: The ESLint rule claude/permissions-path-rule-tool, which reports a path rule for Write, NotebookEdit, MultiEdit or Glob, because Claude Code checks file permissions against Edit and Read rules only and never consults it.
owner: brianespinosa
created: 2026-10-01
related_issues: [15]
stale_after: 2027-03-29
generated:
  by: claude-code
  at: 2026-10-01T00:00:00Z
---

# `permissions-path-rule-tool`

Write a path rule as Edit(path) or Read(path).

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/SKILL.md`, `**/commands/**/*.md` |

## Rule details

Claude Code checks file permissions against `Edit(path)` and `Read(path)` rules only. A path rule for `Write`,
`NotebookEdit`, `Glob` or the legacy `MultiEdit` tool is accepted and never consulted.[^read] Claude Code warns at
startup.[^warning] A bare name such as `Write` is a rule for the whole tool, and it works.

The rule reports a rule with parentheses for one of those four tools. The message names the rule to use instead.
`Edit(path)` covers `Write`, `NotebookEdit` and `MultiEdit`. `Read(path)` covers `Glob`.

The rule does not report `Grep(path)` or `LSP(path)`. The tools table says that `Read` rules apply to both tools.[^tools] The
docs do not say that Claude Code never consults a path rule for them.

The rule accepts a deny or ask rule in the `param:value` form.
[`permissions-param-rule`](permissions-param-rule.md) reads those. It skips a string that does not parse.
[`permissions-rule-syntax`](permissions-rule-syntax.md) reports it.

## Skill and command files

The rule also reads a skill file (`SKILL.md`) and a command file. In the frontmatter, `allowed-tools` is an allow list,
and `disallowed-tools` is a deny list.[^skill][^fields] Each field takes a space- or comma-separated string, or a YAML
list. A space inside parentheses does not split a rule. The rule reports at the entry. It reads no other frontmatter
field. It skips a field that is neither a string nor a list. It does not read the `tools` field of a subagent.
[`agent-tools-known`](agent-tools-known.md) checks that field.

Fail:

```json
{ "permissions": { "deny": ["Write(docs/**)", "Glob(docs/**)"] } }
```

Fail, in a skill:

```yaml
---
name: example
allowed-tools: Write(docs/**)
---
```

Pass:

```json
{ "permissions": { "deny": ["Edit(docs/**)", "Read(docs/**)", "Write"] } }
```

## Sources

[^read]: [Configure permissions: Read and Edit](https://code.claude.com/docs/en/permissions#read-and-edit)
[^warning]: [Error reference: Is not matched by file permission checks](https://code.claude.com/docs/en/errors#is-not-matched-by-file-permission-checks)
[^tools]: [Tools reference: Configure tools with permission rules and hooks](https://code.claude.com/docs/en/tools-reference#configure-tools-with-permission-rules-and-hooks)
[^skill]: [Extend Claude with skills: Pre-approve tools for a skill](https://code.claude.com/docs/en/skills#pre-approve-tools-for-a-skill)
[^fields]: [Extend Claude with skills: Frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)
