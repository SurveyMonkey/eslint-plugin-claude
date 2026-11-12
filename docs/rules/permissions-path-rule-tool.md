---
type: Reference
description: The ESLint rule claude/permissions-path-rule-tool, which reports a path rule for Write, NotebookEdit, MultiEdit, Glob or Grep, because Claude Code checks file permissions against Edit and Read rules only and never consults it.
owner: brianespinosa
created: 2026-10-01
related_issues: [15]
stale_after: 2027-03-29
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# claude/permissions-path-rule-tool

📝 Write a path rule as Edit(path) or Read(path).

💼 This rule is enabled in the following configs: ✅ `recommended`, 🔒 `strict`.

<!-- end auto-generated rule header -->

| Category | Files                                                                                                                                                          |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| no-op    | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/SKILL.md`, `**/commands/**/*.md` |

The rule also lints the managed settings files: `managed-settings.json` and each `managed-settings.d/*.json` drop-in. It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

Claude Code checks file permissions against `Edit(path)` and `Read(path)` rules only. A path rule for `Write`,
`NotebookEdit`, `Glob`, `Grep` or the legacy `MultiEdit` tool is accepted and never consulted.[^never-match] Claude Code warns at
startup for the first four.[^warning] A bare name such as `Write` is a rule for the whole tool, and it works.

The rule reports a rule with a path for one of those five tools. The message names the rule to use instead.
`Edit(path)` covers `Write`, `NotebookEdit` and `MultiEdit`. `Read(path)` covers `Glob` and `Grep`.

The docs say that `Bash(*)` is equivalent to `Bash`.[^match-all] The permissions page covers "a path other than `*`".[^never-match]
So the rule reads `Write(*)` as the bare tool, and reports no permission rule with the specifier `*`. It still reports an empty specifier, as `Write()`.

The rule does not report `LSP(path)`. The tools table says that `Read` rules apply to `LSP`.[^tools]
No docs page says that an `LSP(path)` rule does not match.

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
{ "permissions": { "deny": ["Write(docs/**)", "Glob(docs/**)", "Grep(docs/**)"] } }
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
{ "permissions": { "deny": ["Edit(docs/**)", "Read(docs/**)", "Write", "Grep(*)"] } }
```

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/permissions-path-rule-tool': 'error'
```

## Sources

[^never-match]: [Configure permissions: Write(path), Glob(path), and Grep(path) rules don't match](https://code.claude.com/docs/en/permissions#path-rules-that-never-match)
[^match-all]: [Configure permissions: Match all uses of a tool](https://code.claude.com/docs/en/permissions#match-all-uses-of-a-tool)
[^warning]: [Error reference: Is not matched by file permission checks](https://code.claude.com/docs/en/errors#is-not-matched-by-file-permission-checks)
[^tools]: [Tools reference: Configure tools with permission rules and hooks](https://code.claude.com/docs/en/tools-reference#configure-tools-with-permission-rules-and-hooks)
[^skill]: [Extend Claude with skills: Pre-approve tools for a skill](https://code.claude.com/docs/en/skills#pre-approve-tools-for-a-skill)
[^fields]: [Extend Claude with skills: Frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)
