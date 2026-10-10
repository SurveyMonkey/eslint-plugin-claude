---
type: Reference
description: The ESLint rule claude/hooks-matcher-legacy-version, which reports a hook matcher that an older Claude Code reads in another way or does not know, when the option minVersion names an older version.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-matcher-legacy-version`

Write the hook matchers so that the oldest supported Claude Code reads them.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

The rule makes no report unless the option `minVersion` is set. It is the oldest Claude Code version that your
team supports. The rule reports a matcher form when `minVersion` is below the first version that reads the
form. A `minVersion` equal to that version is no fault.

| Fault | First version | The docs say |
|-------|---------------|--------------|
| A comma list, such as `Bash,PowerShell` | v2.1.191 | "Before v2.1.191, a comma fell through to regex evaluation and the matcher never matched".[^debug] |
| `cloud_credential_error` on `StopFailure` | v2.1.267 | The value needs "Claude Code v2.1.267 or later".[^patterns] |
| `quota_auto_resume_fired`, `quota_auto_resume_stale` or `quota_auto_resume_disabled` on `Notification` | v2.1.234 | The three types "require Claude Code v2.1.234 or later".[^notification] |
| A hyphenated name, such as `code-reviewer` | v2.1.195 | The changelog only (see below). |

### The hyphenated name

The changelog for v2.1.195 says that a hook matcher with a hyphenated name, such as `code-reviewer`, matched as
a substring before that version. It matches the whole name from v2.1.195. The current docs do not
state this version, so the rule cites the [changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)
in this text and not in a footnote. Before v2.1.195, write `^code-reviewer$`. An anchor makes the matcher a
regular expression on every version.

### What the rule reads

- It reads a matcher that holds exact-match characters only.[^patterns] A regular expression is not a fault.
- The comma check and the hyphen check apply to the events that read a free matcher: the tool events,
  `SubagentStart`, `SubagentStop` and the like. The comma check also covers an event with a fixed set of values.
- It makes no report for `FileChanged` and `StopFailure` on a comma or a hyphen. Those events read both as a
  regular expression, and [`hooks-matcher-syntax`](hooks-matcher-syntax.md) reports them.
- It makes no report for a hyphen on an event with a fixed set of values, which
  [`hooks-matcher-enum`](hooks-matcher-enum.md) reports. It makes none on an event without matcher support,
  which [`hooks-matcher-unsupported-event`](hooks-matcher-unsupported-event.md) reports.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, no plugin agent, and no `hooks.json` that Claude Code does not read.

Fail, with `minVersion: "2.1.150"`, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "Bash,PowerShell", "hooks": [{ "type": "command", "command": "./check.sh" }] }]
  }
}
```

Pass:

```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "Bash|PowerShell", "hooks": [{ "type": "command", "command": "./check.sh" }] }]
  }
}
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `minVersion` | none | The oldest Claude Code version that you support, as `major.minor.patch`, such as `"2.1.150"`. Optional. |

```js
'claude/hooks-matcher-legacy-version': ['warn', { minVersion: '2.1.150' }]
```

The option has no default. A config that sets only the severity makes no report. The `recommended` and
`strict` configs set no option. The message names the `minVersion` that you set.

## Sources

[^debug]: [Debug your config: Check hooks](https://code.claude.com/docs/en/debug-your-config#check-hooks)
[^patterns]: [Hooks reference: Matcher patterns](https://code.claude.com/docs/en/hooks#matcher-patterns)
[^notification]: [Hooks reference: Notification](https://code.claude.com/docs/en/hooks#notification)
