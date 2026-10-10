---
type: Reference
description: The ESLint rule claude/sandbox-filesystem-disabled-conflict, which reports sandbox.filesystem.disabled set to true in a managed settings file that also holds denyRead entries or credentials.files deny entries, because Claude Code does not enforce those entries while filesystem isolation is off.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `sandbox-filesystem-disabled-conflict`

Do not set `sandbox.filesystem.disabled` in a file that holds entries which it switches off.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule lints the managed settings files only. It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

`sandbox.filesystem.disabled: true` skips filesystem isolation and keeps network isolation.[^disabled] With the layer off,
Claude Code does not enforce `filesystem.denyRead` or the `deny` entries of `credentials.files`. It still enforces
`credentials.envVars` entries and the `mask` entries that it applies.[^changes] So a file that sets `disabled` and also lists
`denyRead` paths or a `deny` credential file states a protection that does not hold.

The rule reports the value of `disabled` once for a file. A quoted `"true"` counts as `true` in a managed file, so the rule
reports it.[^managed] The message names the kinds of entry that the file holds:
`filesystem.denyRead` entries, `credentials.files` entries with `"mode": "deny"`, or both.

The rule is silent in these cases:

- `disabled` is `false`, is not a Boolean, or is a quoted `"false"`.
- The file has no entry that `disabled` switches off. An empty `denyRead` list, a `credentials.files` list with `mask` entries
  only, and `allowWrite` or `denyWrite` entries do not count.
- The file is a project file or a local file. See the next section.

### A project file

Only user settings, managed settings and the `--settings` flag can set `filesystem.disabled`. A project file and a local
file cannot, so a checked-out project cannot switch off filesystem isolation.[^which] Claude Code ignores the key in those
files, and the `denyRead` entries of the file stay in force. There is no conflict to report.
[`settings-key-scope`](settings-key-scope.md) reports the key itself in a project file.

### Not checked

The rule reads one file. It does not read a sibling file of the same managed source. A `denyRead` entry in `managed-settings.json`
with a `disabled` in a drop-in gets no report. It also does not read the user file of a developer. A `mask` entry that Claude
Code degrades to `deny` at startup, and the lock that managed `sandbox.filesystem` entries put on the key, are not read.[^which]

The rule reads the last of two keys of one name, as `JSON.parse` does.

Fail, in `managed-settings.json`:

```json
{
  "sandbox": {
    "filesystem": {
      "disabled": true,
      "denyRead": ["~/.aws/credentials"]
    }
  }
}
```

Pass, in `managed-settings.json`:

```json
{
  "sandbox": {
    "filesystem": {
      "disabled": true
    },
    "network": {
      "allowedDomains": ["github.com", "*.npmjs.org"]
    }
  }
}
```

## Options

None.

## Sources

[^disabled]: [All settings: sandbox.filesystem.disabled](https://code.claude.com/docs/en/settings-reference#sandbox-filesystem-disabled)
[^changes]: [Configure the sandboxed Bash tool: What changes when filesystem isolation is off](https://code.claude.com/docs/en/sandboxing#what-changes-when-filesystem-isolation-is-off)
[^which]: [Configure the sandboxed Bash tool: Which settings can disable it](https://code.claude.com/docs/en/sandboxing#which-settings-can-disable-it)
[^managed]: [Deploy managed settings: Invalid values inside sandbox](https://code.claude.com/docs/en/managed-settings#invalid-values-inside-sandbox)
