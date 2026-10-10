---
type: Reference
description: The ESLint rule claude/hooks-filechanged-star-matcher, which reports a "*" matcher on FileChanged, because Claude Code also adds a file named * to the watch list.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-filechanged-star-matcher`

Omit the matcher of a FileChanged hook instead of `"*"`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

The `matcher` of a `FileChanged` group has two jobs. Claude Code splits it on `|` and adds each segment to the
watch list as a literal file name. It then uses the same value to choose which hook groups run for a changed
file.[^filechanged]

A `"*"` matcher matches every changed file. It also adds a file named `*` to the watch list, like any other
value.[^filechanged] An omitted matcher matches every watched file and adds no file to the list.

The rule reports a `FileChanged` matcher with a segment that is exactly `*`. It reports once for a matcher. An
omitted matcher, an empty matcher and a named file get no report. A segment such as `*.env` or `**` is a
different fault. [`hooks-matcher-syntax`](hooks-matcher-syntax.md) reports it, and it skips a `*` segment, so
the two rules never report the same segment.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, no plugin agent, and no `hooks.json` that Claude Code does not read.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "FileChanged": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "./reload-env.sh" }] }]
  }
}
```

A group with no matcher adds no file to the watch list. The example below fires only when another group or a
`watchPaths` hook starts the watcher.[^filechanged] A "*" segment is not a fix by itself, because no file is named "*".

Pass:

```json
{
  "hooks": {
    "FileChanged": [{ "hooks": [{ "type": "command", "command": "./reload-env.sh" }] }]
  }
}
```

## Sources

[^filechanged]: [Hooks reference: FileChanged](https://code.claude.com/docs/en/hooks#filechanged)
