---
type: Reference
description: The ESLint rule claude/permissions-specifier-unsupported, which reports a permission rule with a specifier for a tool that takes the bare name only, such as WebSearch, because the rule does not match as written.
owner: brianespinosa
created: 2026-10-01
related_issues: [15]
stale_after: 2027-03-29
generated:
  by: claude-code
  at: 2026-10-01T00:00:00Z
---

# `permissions-specifier-unsupported`

Write a tool that takes no specifier as its bare name.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/SKILL.md`, `**/commands/**/*.md` |

The rule also lints the managed settings files: `managed-settings.json` and each `managed-settings.d/*.json` drop-in. It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

The rule format table of the tools reference lists the tools that take a specifier: `Bash`, `Monitor`, `PowerShell`,
`Read`, `Grep`, `Glob`, `LSP`, `Edit`, `Write`, `NotebookEdit`, `Skill`, `Agent` and `WebFetch`. `WebSearch` is in the
table with "No specifier". A tool that the table does not list, such as `ExitPlanMode` or `ShareOnboardingGuide`, accepts the
bare tool name only.[^tools] `Task`, the old name of `Agent`, and `Cd` also take a specifier.[^task][^cd]

The rule reports a rule with parentheses for a built-in tool that takes no specifier. A deny or ask rule can match a
top-level input parameter of any built-in tool with `Tool(param:value)`.[^param] The rule accepts that form in deny and
ask. An allow rule has no parameter form.

The rule skips these cases, because the docs do not say what they take:

- an unknown tool
- an MCP tool
- a tool with a name that holds a glob

It also skips a path rule for `Write`, `NotebookEdit`, `MultiEdit` and `Glob`.
[`permissions-path-rule-tool`](permissions-path-rule-tool.md) reports those. It skips a string that does not parse.
[`permissions-rule-syntax`](permissions-rule-syntax.md) reports it.

## Skill and command files

The rule also reads a skill file (`SKILL.md`) and a command file. In the frontmatter, `allowed-tools` is an allow list,
and `disallowed-tools` is a deny list.[^skill][^fields] Each field takes a space- or comma-separated string, or a YAML
list. A space inside parentheses does not split a rule. The rule reports at the entry. It reads no other frontmatter
field. It skips a field that is neither a string nor a list. It does not read the `tools` field of a subagent.
[`agent-tools-known`](agent-tools-known.md) checks that field.

Fail:

```json
{ "permissions": { "allow": ["WebSearch(rust)"], "deny": ["ExitPlanMode(plan)"] } }
```

Fail, in a skill:

```yaml
---
name: example
allowed-tools: WebSearch(rust)
---
```

Pass:

```json
{ "permissions": { "allow": ["WebSearch"], "deny": ["WebSearch(query:rust)"] } }
```

## Sources

[^tools]: [Tools reference: Configure tools with permission rules and hooks](https://code.claude.com/docs/en/tools-reference#configure-tools-with-permission-rules-and-hooks)
[^param]: [Configure permissions: Match by input parameter](https://code.claude.com/docs/en/permissions#match-by-input-parameter)
[^task]: [Create custom subagents: Restrict which subagents can be spawned](https://code.claude.com/docs/en/sub-agents#restrict-which-subagents-can-be-spawned)
[^cd]: [Configure permissions: Cd](https://code.claude.com/docs/en/permissions#cd)
[^skill]: [Extend Claude with skills: Pre-approve tools for a skill](https://code.claude.com/docs/en/skills#pre-approve-tools-for-a-skill)
[^fields]: [Extend Claude with skills: Frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)
