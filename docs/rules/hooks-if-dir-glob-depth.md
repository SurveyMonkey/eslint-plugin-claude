---
type: Reference
description: The ESLint rule claude/hooks-if-dir-glob-depth, which reports a single-segment directory pattern such as Edit(src/**) in a hook if condition when minVersion is v2.1.214 or later, because the pattern matches only the top-level directory.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-if-dir-glob-depth`

Write a directory pattern in a hook `if` condition so that it matches at the depth you mean.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

In an `if` condition for a file tool, a single-segment directory pattern such as `Edit(src/**)` matches only the
`src` directory in the working directory and the files under it. To match a directory named `src` at any depth,
write `Edit(**/src/**)`. Before v2.1.214, `Edit(src/**)` matched a directory named `src` at any depth.[^common]

The docs state both behaviors. A repository file does not say which Claude Code version runs it. So the rule makes
no report unless you set the option `minVersion` to v2.1.214 or later. With a lower `minVersion`, the old
behavior can apply, and the rule makes no report.

The rule reads the `if` string of a handler on a tool event. It reports a rule for `Read`, `Grep`, `Glob`,
`Edit`, `Write` or `NotebookEdit` with a pattern of the form `name/**`. The `name` is one segment with no glob
character. It does not start with `!` or `~`, and it is not `.` or `..`. The rule reports at the `if` value. The
message names the pattern that matches at any depth.

The rule is `off` in `recommended`. The pattern is correct when you mean the top-level directory only. The rule
cannot know what you mean. Turn it on to find the patterns that a v2.1.214 upgrade changed.

The rule applies the hooks reference only. The permissions page says that a deny or ask rule in the settings
`permissions` lists matches at any depth for such a pattern.[^read] The rule does not read those lists.

The rule makes no report for these `if` values: `Edit(**/src/**)`, `Edit(/src/**)`, `Edit(./src/**)`,
`Edit(src/components/**)`, a pattern with a glob character in the first segment, and a tool that is not a file tool.
[`hooks-if-condition`](hooks-if-condition.md) reports an `if` that is not one rule, and an `if` on an event that is
not a tool event. This rule makes no report for those.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, no plugin agent, and no `hooks.json` that Claude Code does not read.

Fail, with `minVersion: "2.1.214"`, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      { "hooks": [{ "type": "command", "command": "./fmt.sh", "if": "Edit(src/**)" }] }
    ]
  }
}
```

Pass:

```json
{
  "hooks": {
    "PostToolUse": [
      { "hooks": [{ "type": "command", "command": "./fmt.sh", "if": "Edit(**/src/**)" }] }
    ]
  }
}
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `minVersion` | none | The oldest Claude Code version that you support, as `major.minor.patch`, such as `"2.1.214"`. Optional. |

```js
'claude/hooks-if-dir-glob-depth': ['warn', { minVersion: '2.1.214' }]
```

The option has no default. A config that sets only the severity makes no report. The `recommended` and `strict`
configs set no option. The message names the `minVersion` that you set.

## Sources

[^common]: [Hooks reference: Common fields](https://code.claude.com/docs/en/hooks#common-fields)
[^read]: [Configure permissions: Read and Edit](https://code.claude.com/docs/en/permissions#read-and-edit)
