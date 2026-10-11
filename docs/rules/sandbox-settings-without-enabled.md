---
type: Reference
description: The ESLint rule claude/sandbox-settings-without-enabled, a heuristic that reports a settings file that sets sandbox keys when no file of its source sets sandbox.enabled to true, because the default is false and Claude Code then runs commands unsandboxed.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `sandbox-settings-without-enabled`

Set `sandbox.enabled` to `true` in a source that sets other sandbox keys.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. It is a heuristic, so `strict` turns it on at `warn`.

## Rule details

`sandbox.enabled` is `false` by default, and then Claude Code runs Bash commands unsandboxed.[^enabled] The other `sandbox` keys
limit commands only while the sandbox runs. `failIfUnavailable` acts only when `enabled` is `true`.[^fail]

The rule reports a file that has a `sandbox` object with a key other than `enabled`, when no file of its source sets `enabled`
to `true`. It reports once for the file, on the `sandbox` value. A source is the project pair (`.claude/settings.json` and
`.claude/settings.local.json`), or the files of one managed source. The two sources never mix.

### What the rule does not read

- A user settings file. It is outside the repository (ADR 001, Decision 14), and the docs say that `~/.claude/settings.json` can
  enable the sandbox for every project.[^enabled] A report here can be wrong for that reason, which is why the rule is `off` in
  `recommended`.
- A source with a file that the rule cannot read. That file can set `enabled`, so the rule gives no report.
- A managed `enabled` that is not a Boolean. Claude Code reads a quoted `"true"` as `true`, and any other invalid value as
  `true` too.[^invalid]

### Docs examples

The docs show most `sandbox` keys as a fragment, for example `"excludedCommands": ["docker *"]`.[^excluded] The rule reads a
fragment as a file that sets that key, so it reports a fragment. The `sandbox` example of the settings reference sets `enabled`
as well, and so does each example of the sandboxing page that turns the sandbox on. The rule reports none of them.

Fail:

```json
{ "sandbox": { "filesystem": { "denyRead": ["~/.aws/credentials"] } } }
```

Pass:

```json
{ "sandbox": { "enabled": true, "filesystem": { "denyRead": ["~/.aws/credentials"] } } }
```

## Options

None.

## Sources

[^enabled]: [All settings: sandbox.enabled](https://code.claude.com/docs/en/settings-reference#sandbox-enabled)
[^fail]: [All settings: sandbox.failIfUnavailable](https://code.claude.com/docs/en/settings-reference#sandbox-failifunavailable)
[^excluded]: [All settings: sandbox.excludedCommands](https://code.claude.com/docs/en/settings-reference#sandbox-excludedcommands)
[^invalid]: [Managed settings: Invalid values inside sandbox](https://code.claude.com/docs/en/managed-settings#invalid-values-inside-sandbox)
