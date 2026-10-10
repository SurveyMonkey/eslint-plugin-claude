---
type: Reference
description: The ESLint rule claude/agent-field-min-version, which reports a subagent field that needs a newer Claude Code version than the option minVersion allows, and a Boolean written as yes, no, on, off, 1 or 0, which versions before v2.1.218 do not read.
owner: brianespinosa
created: 2026-10-10
related_issues: [9]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `agent-field-min-version`

Use only the subagent fields that the oldest Claude Code version supports.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/agents/**/*.md`, in `.claude/agents/` and in the `agents/` directory of a plugin |

## Rule details

Some fields were added in a later Claude Code release. A team that supports an older release needs to know
which fields the old release does not read. The rule reports these cases when the option `minVersion` is lower than
the version that added the field:

| Case | First version | Where |
|------|---------------|-------|
| `omitClaudeMd` is set | v2.1.271 | Local and plugin agents. The docs say "Requires Claude Code v2.1.271 or later".[^fields] |
| `experimental` holds `cacheTtl` | v2.1.248 | Local and plugin agents. The docs say "Requires Claude Code v2.1.248 or later".[^fields] |
| `permissionMode: manual` | v2.1.200 | Local agents only. Claude Code ignores `permissionMode` in a plugin agent.[^fields] |
| `background` or `omitClaudeMd` is `yes`, `no`, `on`, `off`, `1` or `0` | v2.1.218 | Local and plugin agents. |

The docs of the sub-agents page give the first two versions.[^fields] The page names `manual` as an alias for
`default`, and gives no version.[^modes] The [changelog file](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) records the
`manual` alias under v2.1.200 for the CLI flag and for `defaultMode`. The rule applies the same version to the
subagent field.

The changelog of v2.1.218 adds `yes`, `no`, `on`, `off`, `1` and `0` as values for skill and plugin
frontmatter Booleans, besides `true` and `false`. No agent page lists these forms, so the rule applies the version to agent files by inference. The Boolean rules in this plugin accept them, and this rule reports
them when `minVersion` is below v2.1.218. The rule reads a quoted `"true"` or `"false"` as a form that it does not
report, because no source says how older versions read it.

The rule reports `omitClaudeMd: yes` twice when `minVersion` is below both versions: once for the field,
and once for the Boolean form.

With no `minVersion`, the rule is inactive. The file does not show which Claude Code versions its users run. The rule
makes no report on a field with no value, or on a value that is not a Boolean at all. [`agent-frontmatter-schema`](agent-frontmatter-schema.md)
reports those.

Fail, with `minVersion` set to `2.1.200`:

```markdown
---
name: reviewer
description: Reviews code.
omitClaudeMd: yes
---
```

Pass, with the same option:

```markdown
---
name: reviewer
description: Reviews code.
background: true
---
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `minVersion` | none | The lowest Claude Code version that the team supports, as `major.minor.patch`. Optional. |

```js
'claude/agent-field-min-version': ['warn', { minVersion: '2.1.200' }]
```

With no `minVersion`, the rule reports nothing. The `recommended` and `strict` configs set no option, so they do not
activate the rule. Each message names the configured `minVersion`.

## Sources

[^fields]: [Create custom subagents: Frontmatter reference](https://code.claude.com/docs/en/sub-agents#supported-frontmatter-fields)
[^modes]: [Create custom subagents: Permission modes](https://code.claude.com/docs/en/sub-agents#permission-modes)
