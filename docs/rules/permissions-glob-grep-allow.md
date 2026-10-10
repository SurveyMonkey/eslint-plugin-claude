---
type: Reference
description: The ESLint rule claude/permissions-glob-grep-allow, which reports a bare Glob or Grep allow rule in a settings file, because on macOS, Linux and WSL such a rule does not bring the tool back, and only --tools or --allowedTools do.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-glob-grep-allow`

Do not rely on a `Glob` or `Grep` `allow` rule to restore the tool.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule reads no hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

On macOS, Linux and WSL, Claude Code leaves the Glob and Grep tools out of the default tool set. Claude then searches with `find` and
`grep` through the Bash tool.[^glob] Naming `Glob` or `Grep` in `--tools` or `--allowedTools` brings the tools back.
"An allow rule in a settings file doesn't have this effect."[^glob] On Windows, both tools are in the default tool set, so the
rule is no fault there. The docs state this for every version, so the rule has no version option.

The rule reports a bare `Glob` or `Grep` rule in `allow`. The message names the tool and the flags.

### One report for one fault

- `Glob(path)` is a path rule that Claude Code never consults. `permissions-path-rule-tool` reports it.
- A `Grep(<specifier>)` rule is not checked, because the docs say nothing about it.
- An `allow` rule that a bare `deny` or `ask` rule of the same tool covers is for `permissions-dead-allow`. This rule skips it.
  The two rules read the same source: the project pair, or one managed source.
- `ask` and `deny` rules are not read.

Fail:

```json
{ "permissions": { "allow": ["Glob", "Grep"] } }
```

Pass:

```json
{ "permissions": { "allow": ["Read", "Bash(rg *)"] } }
```

## Options

None.

## Sources

[^glob]: [Tools reference: Glob tool behavior](https://code.claude.com/docs/en/tools-reference#glob-tool-behavior)
