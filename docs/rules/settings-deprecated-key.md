---
type: Reference
description: The ESLint rule claude/settings-deprecated-key, which reports a deprecated settings key that Claude Code still honors, such as includeCoAuthoredBy, voiceEnabled, and disableArtifact set to true.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-deprecated-key`

Replace a deprecated settings key that Claude Code still honors.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | deprecated | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

The settings reference marks three keys as deprecated. Claude Code still reads each of them.
The rule reports the key, and the message names the key to use in its place. The list is
`DEPRECATED_KEYS` in `src/data/settings-keys.ts`.

| Key | Replacement | Source |
|-----|-------------|--------|
| `includeCoAuthoredBy` | `attribution`. Deprecated since v2.0.62 | [^coauthored][^attribution] |
| `voiceEnabled` | `voice.enabled`. Deprecated since v2.1.92 | [^voice] |
| `disableArtifact: true` | `enableArtifact: false` | [^artifact] |

The report is on the key, for any value of `includeCoAuthoredBy` and `voiceEnabled`. A `null` is
no value, so it gives no report. For `disableArtifact`, the rule reports the Boolean `true` only.

### Overlap with `settings-removed-key`

`settings-removed-key` reports a deprecated key that Claude Code no longer honors. This rule
makes no report on that case, so each fault gets one report:

- `disableArtifact: false`. Claude Code ignores the value.[^artifact]
- `includeCoAuthoredBy` once `attribution.commit` or `attribution.pr` is set.[^coauthored]
- `voiceEnabled` once `voice.enabled` is set.[^voice]

A replacement key counts as set when its value is not `null`, as in `settings-removed-key`.

### What the rule does not check

- `ignorePatterns`. The key is deprecated too, and the permissions group owns it
  (`permissions-ignore-patterns`, which suggests `permissions.deny` `Read` rules).
- A hidden file in `managed-settings.d/`. Claude Code ignores it.
- A value of another type. `settings-schema` reports it.

When a file has two keys of one name, the rule reads the last, as `JSON.parse` does.

Fail:

```json
{
  "includeCoAuthoredBy": false,
  "voiceEnabled": true,
  "disableArtifact": true
}
```

Pass:

```json
{
  "attribution": { "commit": "", "pr": "", "sessionUrl": false },
  "voice": { "enabled": true },
  "enableArtifact": false
}
```

## Sources

[^coauthored]: [All settings: includeCoAuthoredBy](https://code.claude.com/docs/en/settings-reference#includecoauthoredby)
[^attribution]: [All settings: attribution](https://code.claude.com/docs/en/settings-reference#attribution)
[^voice]: [All settings: voiceEnabled](https://code.claude.com/docs/en/settings-reference#voiceenabled)
[^artifact]: [All settings: disableArtifact](https://code.claude.com/docs/en/settings-reference#disableartifact)
