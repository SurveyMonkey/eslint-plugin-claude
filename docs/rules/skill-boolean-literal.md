---
type: Reference
description: The ESLint rule claude/skill-boolean-literal, which reports a disable-model-invocation or user-invocable field that is set to yes, no, on, off, 1 or 0 instead of true or false, because Claude Code before v2.1.218 reads only true and false, with its option, examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [50]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `skill-boolean-literal`

Write a Boolean field of a skill as `true` or `false`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/SKILL.md`, `**/commands/**/*.md` |

## Rule details

Boolean fields accept `yes`, `no`, `on`, `off`, `1` and `0` in any letter case, in addition to
`true` and `false`. Before v2.1.218, Claude Code recognized only `true` and `false`.[^reference]
The rule reports a Boolean field that holds another form. An older client does not read the
field as the author meant.

The rule checks `disable-model-invocation` and `user-invocable`. It does not check `background`.
That field needs Claude Code v2.1.218 itself,[^reference] so an older client ignores the field
whatever its form.

The rule reads the parsed value, not the source text. YAML reads `true`, `True` and `TRUE` as a
Boolean, so the rule accepts them. It reports each other value that the Boolean reader accepts:

- `yes`, `no`, `on` and `off`, in any letter case.
- `1` and `0`, and other numbers that read as `1` or `0`, such as `1.0`.
- A quoted string, such as `"true"` or `'yes'`.

The skills page does not say how Claude Code reads a number such as `0x1` or a quoted string. The
rule reports them, because they are not `true` or `false`.

A value that is not a Boolean form, such as `maybe`, is not a report. A field with no value is
not a report. The rule ignores a file with no frontmatter, and a file whose frontmatter does
not parse.

The rule checks skill files and command files. For a plugin, a plugin command file takes the same
fields as a skill. A file elsewhere, such as `docs/SKILL.md`, is not a report.

Fail:

```markdown
---
name: deploy
disable-model-invocation: yes
user-invocable: off
---
```

Pass:

```markdown
---
name: deploy
disable-model-invocation: true
user-invocable: false
---
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `minVersion` | unset | The oldest Claude Code version that the repository supports, such as `2.1.218`. Optional. |

```js
'claude/skill-boolean-literal': ['warn', { minVersion: '2.1.218' }]
```

With no `minVersion`, the plugin cannot know the version of the client. So the rule reports.
When `minVersion` is `2.1.218` or later, the rule makes no report. The value has three numbers,
such as `2.1.218`. The `recommended` and `strict` configs set no option.

## Sources

[^reference]: [Extend Claude with skills: Frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)
