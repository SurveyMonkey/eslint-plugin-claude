---
type: Reference
description: The ESLint rule claude/skill-plugin-name-prefix, which reports a plugin skill whose name starts with the plugin prefix, because Claude Code from v2.1.216 through v2.1.245 adds the prefix again, with its option, examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [50]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `skill-plugin-name-prefix`

Do not start the name of a plugin skill with the plugin prefix.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/SKILL.md` |

The rule makes no report until the option `minVersion` is set.

## Rule details

Claude Code adds the plugin prefix to the command name of a plugin skill. The skill
`my-plugin/skills/review/SKILL.md` becomes `/my-plugin:review`. When the `name` field already
starts with the prefix, Claude Code v2.1.246 and later does not add it again. From v2.1.216
through v2.1.245, Claude Code added it a second time.[^name] So `name: my-plugin:review` showed
as `/my-plugin:my-plugin:review` in the `/` menu on those versions.

The rule reports a `name` that starts with `<plugin>:`. The plugin name is the `name` in
`.claude-plugin/plugin.json`. If the manifest has no `name`, the rule uses the name of the
plugin directory. The report points at the value of `name`.

The rule checks a plugin skill in `<plugin>/skills/<name>/SKILL.md` and a plugin-root
`<plugin>/SKILL.md`. It is silent in these cases:

- The file is not in a plugin. A project skill has no prefix.
- A command file. Claude Code does not read the `name` of a command file.
- A `name` that is not a string.
- The rule cannot read the manifest, or the manifest is out of the repository. A plugin root
  that the rule cannot see gives no report.

The rule reads the repository files only (ADR 001, Decision 14).

Fail, in the plugin `my-plugin`:

```markdown
---
name: my-plugin:review
description: Reviews a change.
---
```

Pass:

```markdown
---
name: review
description: Reviews a change.
---
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `minVersion` | unset | The oldest Claude Code version that the repository supports, such as `2.1.230`. Optional. |

```js
'claude/skill-plugin-name-prefix': ['warn', { minVersion: '2.1.230' }]
```

With no `minVersion`, the rule is inactive and makes no report. The `recommended` and `strict`
configs set no option, so a team turns the rule on when it sets its floor. The example turns the
rule on for a floor older than 2.1.246. When `minVersion` is `2.1.246` or later, the rule makes
no report. The value has three numbers, such as `2.1.246`.

## Sources

[^name]: [Extend Claude with skills: How a skill gets its command name](https://code.claude.com/docs/en/skills#how-a-skill-gets-its-command-name)
