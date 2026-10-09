---
type: Reference
description: The ESLint rule claude/settings-removed-key, which reports a settings key that Claude Code ignores, such as taskOutputMaxChars, keybindingFlavor, permissionExplainerEnabled, teammateDefaultModel, disableArtifact false, and includeCoAuthoredBy or voiceEnabled once their replacement is set.
owner: brianespinosa
created: 2026-10-08
related_issues: [14]
stale_after: 2027-04-08
generated:
  by: claude-code
  at: 2026-10-08T00:00:00Z
---

# `settings-removed-key`

Remove a settings key that Claude Code ignores.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

Claude Code reads some keys and does not act on them. The rule reports each such key in each
settings file. The report is on the key. For `disableArtifact`, it is on the value.

The list is in `src/data/settings-keys.ts`, with the Claude Code version of the last review.

### Keys with no effect

| Key | No effect since | Source |
|-----|-----------------|--------|
| `taskOutputMaxChars` | v2.1.277, with the `TaskOutput` tool it sized | [^task] |
| `keybindingFlavor` | v2.1.261. Claude Code still accepts the key | [^flavor] |
| `permissionExplainerEnabled` | v2.1.257, with the `Ctrl+E` command explanation | [^explainer] |
| `teammateDefaultModel` | v2.1.234, with its `/config` row | [^teammate] |

The rule reports these keys for any value.

### Values and replacements

- **`disableArtifact: false`.** Claude Code ignores the value `false`. It honors `true` as
  `enableArtifact: false`.[^artifact] The rule reports `false`, and makes no report on `true`.
  The deprecated `true` is for `settings-deprecated-key`.
- **`includeCoAuthoredBy`.** Claude Code ignores this deprecated key once `attribution.commit` or
  `attribution.pr` is set.[^coauthored][^attribution] Without them, the key still works.
- **`voiceEnabled`.** When `voice.enabled` is set, Claude Code uses it and not `voiceEnabled`.[^voice]
  Without it, the key still works.

A replacing key that is `null` is not set. A replacing key of any other value, an empty string
too, is set. The message names the first replacing key in this order: `attribution.commit`,
`attribution.pr`.

### Overlap with `settings-key-scope`

`permissionExplainerEnabled` and `teammateDefaultModel` are also Global config keys.
`settings-key-scope` would report them as keys that a settings file cannot set. That message does
not say that Claude Code removed the key. So this rule reports them, and `settings-key-scope`
makes no report on them. Each key gets one report, in each file.

### What the rule does not check

- A hidden file in `managed-settings.d/`. Claude Code ignores it, so the rule reads no key in it.
- A key inside `env`, `hooks` or another value. A nested key is no top-level key.
- The deprecated keys that still work. `settings-deprecated-key` is for them.

When a file has two keys of one name, the rule reads the last, as `JSON.parse` does.

Fail, in `.claude/settings.json`:

```json
{
  "taskOutputMaxChars": 20000,
  "disableArtifact": false,
  "includeCoAuthoredBy": false,
  "attribution": { "commit": "" }
}
```

Pass:

```json
{
  "disableArtifact": true,
  "includeCoAuthoredBy": false
}
```

## Sources

[^task]: [All settings: taskOutputMaxChars](https://code.claude.com/docs/en/settings-reference#taskoutputmaxchars)
[^flavor]: [All settings: keybindingFlavor](https://code.claude.com/docs/en/settings-reference#keybindingflavor)
[^explainer]: [All settings: permissionExplainerEnabled](https://code.claude.com/docs/en/settings-reference#permissionexplainerenabled)
[^teammate]: [All settings: teammateDefaultModel](https://code.claude.com/docs/en/settings-reference#teammatedefaultmodel)
[^artifact]: [All settings: disableArtifact](https://code.claude.com/docs/en/settings-reference#disableartifact)
[^coauthored]: [All settings: includeCoAuthoredBy](https://code.claude.com/docs/en/settings-reference#includecoauthoredby)
[^attribution]: [All settings: attribution](https://code.claude.com/docs/en/settings-reference#attribution)
[^voice]: [All settings: voiceEnabled](https://code.claude.com/docs/en/settings-reference#voiceenabled)
