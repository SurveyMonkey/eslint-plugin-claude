---
type: Reference
description: The ESLint rule claude/agent-permission-mode-manual, which reports permissionMode manual in a local subagent file, because manual is an alias and the docs say to write the config value default.
owner: brianespinosa
created: 2026-10-10
related_issues: [9]
stale_after: 2027-04-01
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `agent-permission-mode-manual`

Write permissionMode: default, not the alias manual, in a local subagent.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/agents/**/*.md` |

## Rule details

`permissionMode` accepts `manual` as an alias for `default`. The docs say to use the config
values of the modes, so Manual mode is `default`.[^modes] The alias works, so this is a style
rule. The rule reports the value `manual`. It offers a suggestion that writes `default`.

The match is exact and case-sensitive. [`agent-frontmatter-schema`](agent-frontmatter-schema.md)
reports a value that is not in the list of the docs.

Claude Code ignores `permissionMode` in a plugin agent.[^fields] So the rule checks only agent
files in `.claude/agents/`. [`agent-plugin-ignored-fields`](agent-plugin-ignored-fields.md)
reports the field in a plugin. A file outside these folders gets no report. The rule ignores a
file whose frontmatter does not parse.

Fail:

```markdown
---
name: reviewer
description: Reviews code.
permissionMode: manual
---
```

Pass:

```markdown
---
name: reviewer
description: Reviews code.
permissionMode: default
---
```

## Options

None.

## Sources

[^modes]: [Create custom subagents: Permission modes](https://code.claude.com/docs/en/sub-agents#permission-modes)
[^fields]: [Create custom subagents: Frontmatter reference](https://code.claude.com/docs/en/sub-agents#supported-frontmatter-fields)
