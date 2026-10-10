---
type: Reference
description: The ESLint rule claude/sandbox-scope, which reports a mode mask entry in sandbox.credentials.files or envVars in a project or local settings file, because Claude Code drops those entries from the two files.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `sandbox-scope`

Do not put a `mode: "mask"` credentials entry in a project or local settings file.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

## Rule details

`sandbox.credentials` has the scope any file. Claude Code honors `mask` entries, `allowPlaintextInject`, `awsPairs` and
`sigv4` from user settings, managed settings and the `--settings` flag only.[^credentials] It drops `mask` entries from
`.claude/settings.json` and `.claude/settings.local.json`.[^files][^envvars] A `deny` entry works in every file.

The rule reports the value `"mask"` of `mode` for each entry of `sandbox.credentials.files` and `sandbox.credentials.envVars` in
the two project files. The message names the list and tells the author to move the entry to user or managed settings. A
managed file keeps the entry, so the rule does not read it.

### One report for one fault

The scope of a key is for [`settings-key-scope`](settings-key-scope.md). It reports each key that the settings index limits to
managed settings (`sandbox.bwrapPath`, `socatPath`, `filesystem.allowManagedReadPathsOnly`, `network.allowManagedDomainsOnly`)
or to user and managed settings (`allowAppleEvents`, `ripgrep`, `filesystem.disabled`, `network.strictAllowlist`,
`network.tlsTerminate`, `credentials.allowPlaintextInject`, `awsPairs` and `sigv4`). This rule reads the value of `mode`, which
that rule cannot see. So no line gets two reports.

The rule is silent in these cases:

- The entry has `"mode": "deny"`, or no `mode`. `sandbox-schema` reports a `mode` that is not `deny` or `mask`.
- An entry is not an object, or a list is not an array.

The rule reads the last of two keys of one name, as `JSON.parse` does.

Fail, in `.claude/settings.json`:

```json
{
  "sandbox": {
    "credentials": {
      "envVars": [{ "name": "GITHUB_TOKEN", "mode": "mask", "injectHosts": ["api.github.com"] }]
    }
  }
}
```

Pass, in `.claude/settings.json`:

```json
{
  "sandbox": {
    "credentials": {
      "envVars": [{ "name": "GITHUB_TOKEN", "mode": "deny" }]
    }
  }
}
```

## Options

None.

## Sources

[^credentials]: [All settings: sandbox.credentials](https://code.claude.com/docs/en/settings-reference#sandbox-credentials)
[^files]: [All settings: sandbox.credentials.files](https://code.claude.com/docs/en/settings-reference#sandbox-credentials-files)
[^envvars]: [All settings: sandbox.credentials.envVars](https://code.claude.com/docs/en/settings-reference#sandbox-credentials-envvars)
