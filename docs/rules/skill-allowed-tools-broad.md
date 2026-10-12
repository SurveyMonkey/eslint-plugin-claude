---
type: Reference
description: The ESLint rule claude/skill-allowed-tools-broad, which reports an unscoped grant in the allowed-tools of a skill or command file, such as a bare Bash, Write or Edit, or a rule for a whole MCP server, because Claude Code applies it with no workspace trust.
owner: brianespinosa
created: 2026-10-02
related_issues: [9, 15]
stale_after: 2027-03-30
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# claude/skill-allowed-tools-broad

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| security | `**/SKILL.md`, `**/commands/**/*.md` |

## Rule details

The `allowed-tools` field of a skill grants the tools that it lists. Claude Code asks for no approval in the turn that
invokes the skill.[^preapprove]
Workspace trust does not gate the field. Claude Code applies the `allowed-tools` of a project skill even in a `-p` run in a
folder that you never trusted.[^preapprove] A skill in a repository can grant itself broad access in this way.

The rule reports an entry of `allowed-tools` that grants every use of a tool:

- a bare `Bash`, `PowerShell`, `Write`, `Edit` or `WebFetch`
- `Bash(*)` or `PowerShell(*)`, which the docs make equal to the bare name[^all][^powershell]
- `mcp__<server>__*` or `mcp__<server>`, which each match every tool of one server[^mcp]

A glob after the tool prefix, such as `mcp__github__get_*`, matches some tools, and the rule does not report it.[^wildcards]
`mcp__*` is no grant: Claude Code skips it in an allow rule.[^wildcards]
[`permissions-tool-name-glob`](permissions-tool-name-glob.md) reports it. The permissions page states the skip for
settings rules. The skills page shows permission rules in `allowed-tools`.[^preapprove]

The rule reads `allowed-tools` only. The `disallowed-tools` field removes tools, so a broad entry there is safe.
It reads a space- or comma-separated string, or a YAML list. It reports at the entry.

The docs state the `(*)` form for `Bash` and `PowerShell` only. The rule does not report `Write(*)`, `Edit(*)` or
`WebFetch(*)`. It also skips an entry that does not parse. [`permissions-rule-syntax`](permissions-rule-syntax.md) reports it.

The rule checks the files that the other skill rules check:

- `.claude/skills/<name>/SKILL.md`
- `<plugin>/skills/<name>/SKILL.md`
- `<plugin>/SKILL.md`
- `.claude/commands/**/*.md`
- `<plugin>/commands/**/*.md`

A file elsewhere, such as `docs/SKILL.md`, is not a report.

Fail:

```markdown
---
allowed-tools: Read Bash Write
---
```

Pass:

```markdown
---
allowed-tools: Read Bash(git add *) Bash(git commit *) Edit(docs/**)
---
```

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/skill-allowed-tools-broad': 'error'
```

## Options

<!-- begin auto-generated rule options list -->
<!-- end auto-generated rule options list -->

```js
"claude/skill-allowed-tools-broad": ["error", { allow: ["WebFetch"] }]
```

## Sources

[^preapprove]: [Extend Claude with skills: Pre-approve tools for a skill](https://code.claude.com/docs/en/skills#pre-approve-tools-for-a-skill)
[^all]: [Configure permissions: Match all uses of a tool](https://code.claude.com/docs/en/permissions#match-all-uses-of-a-tool)
[^powershell]: [Configure permissions: PowerShell](https://code.claude.com/docs/en/permissions#powershell)
[^mcp]: [Configure permissions: MCP](https://code.claude.com/docs/en/permissions#mcp)
[^wildcards]: [Configure permissions: Tool name wildcards](https://code.claude.com/docs/en/permissions#tool-name-wildcards)
