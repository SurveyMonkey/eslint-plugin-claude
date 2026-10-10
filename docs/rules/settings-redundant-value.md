---
type: Reference
description: The ESLint rule claude/settings-redundant-value, which reports a settings value that Claude Code treats as an unset key, such as alwaysThinkingEnabled, enableArtifact, syncClaudeAiSkills and syncClaudeAiPlugins set to true, and spinnerVerbs in replace mode with no verbs.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-redundant-value`

Remove a settings value that is the same as an unset key.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

Some values change nothing. The rule reports each one, on the value.

| Key and value | Why it changes nothing | Source |
|---------------|------------------------|--------|
| `alwaysThinkingEnabled: true` | Thinking is on by default | [^thinking] |
| `enableArtifact: true` | It never overrides a `false` from another file, from `CLAUDE_CODE_DISABLE_ARTIFACT`, or from the admin setting of the organization | [^artifact] |
| `syncClaudeAiSkills: true` | Claude Code honors only `false` | [^skills] |
| `syncClaudeAiPlugins: true` | Claude Code honors only `false` | [^plugins] |
| `spinnerVerbs` with `"mode": "replace"` and `"verbs": []` | In replace mode with an empty list, Claude Code keeps the built-in verbs | [^verbs] |

For `spinnerVerbs`, the report is on the empty list. A `replace` mode with no `verbs` key gives no
report, because the docs name the empty array only.

### Overlap with other rules

One fault gets one report, so the rule skips the files where another rule already reports:

- `syncClaudeAiSkills` in `.claude/settings.json`. Claude Code reads the key in user, local and
  managed settings, so `settings-key-scope` reports it in the project file. This rule reports it
  in the local file and in managed files.
- `syncClaudeAiPlugins` in `.claude/settings.json` and `.claude/settings.local.json`.
  `settings-sync-claude-ai-plugins` reports the key in the project file for any value, and a `true`
  in the local file. This rule reports a `true` in managed files only.

### What the rule does not check

- A hidden file in `managed-settings.d/`. Claude Code ignores it.
- A value of another type. `settings-schema` reports it.
- `includeCoAuthoredBy: true`, which is also the same as unset. It is deprecated, and
  `settings-deprecated-key` reports the key.

When a file has two keys of one name, the rule reads the last, as `JSON.parse` does.

Fail:

```json
{
  "alwaysThinkingEnabled": true,
  "enableArtifact": true,
  "spinnerVerbs": { "mode": "replace", "verbs": [] }
}
```

Pass:

```json
{
  "alwaysThinkingEnabled": false,
  "enableArtifact": false,
  "spinnerVerbs": { "mode": "append", "verbs": ["Pondering"] }
}
```

## Sources

[^thinking]: [All settings: alwaysThinkingEnabled](https://code.claude.com/docs/en/settings-reference#alwaysthinkingenabled)
[^artifact]: [All settings: enableArtifact](https://code.claude.com/docs/en/settings-reference#enableartifact)
[^skills]: [All settings: syncClaudeAiSkills](https://code.claude.com/docs/en/settings-reference#syncclaudeaiskills)
[^plugins]: [All settings: syncClaudeAiPlugins](https://code.claude.com/docs/en/settings-reference#syncclaudeaiplugins)
[^verbs]: [All settings: spinnerVerbs](https://code.claude.com/docs/en/settings-reference#spinnerverbs)
