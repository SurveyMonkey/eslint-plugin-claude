---
type: Reference
description: The ESLint rule claude/settings-managed-version-floor, which reports deniedModels or availableModelsMatch set to exact in managed settings with no requiredMinimumVersion of 2.1.283 or later, because earlier versions ignore both keys.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-managed-version-floor`

Set `requiredMinimumVersion` to 2.1.283 or later with `deniedModels` or `availableModelsMatch`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | security | `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

`deniedModels` blocks models, and `availableModelsMatch: "exact"` makes each entry of
`availableModels` permit only the version it names. Both keys need Claude Code v2.1.283 or later.
Earlier versions ignore both keys. The model configuration page says to also set
`requiredMinimumVersion`, to stop those versions at start.[^floor]

The rule reports the key `deniedModels` when its list has an entry. It reports the key
`availableModelsMatch` when its value is `"exact"`. The report is on the key. It makes no report
when the managed source sets `requiredMinimumVersion` to 2.1.283 or later.

The managed source is `managed-settings.json` and each drop-in in `managed-settings.d/` that is not
hidden, merged. The rule reads the linted file and the other files of the source. The order of the
drop-ins is not in view. So one file with a floor of 2.1.283 or later makes the rule silent for
every file of the source. A floor below 2.1.283, or no floor, gets a report.

The rule reads no path out of the repository (ADR 001, Decision 14). It makes no report when it
cannot see a file of the source. A file that does not parse to an object is such a case. So are a
read that fails, a link that has no target, and a link that leads out of the repository. That file
can set the floor. It also
makes no report when a floor is not a version number, such as `latest`. The rule cannot tell what
Claude Code reads. The rule reads the first three numbers and ignores a suffix: `2.1.283-rc1`
counts as 2.1.283. A `null` is no floor.

### What the rule does not check

- An empty `deniedModels` list, which blocks nothing.
- `availableModelsMatch: "prefix"`. It is the behavior of the earlier versions.
- A value of the wrong type. `settings-schema` reports the type and the form of the version.
- A project file or a local file. Claude Code reads both keys from managed settings only, and
  `settings-key-scope` reports them elsewhere.
- A hidden drop-in, which Claude Code ignores.

Fail:

```json
{
  "availableModels": ["opus", "sonnet"],
  "deniedModels": ["claude-opus-5-5"]
}
```

Pass:

```json
{
  "availableModels": ["opus", "sonnet"],
  "deniedModels": ["claude-opus-5-5"],
  "requiredMinimumVersion": "2.1.283"
}
```

## Sources

[^floor]: [Model configuration: Block specific models or versions](https://code.claude.com/docs/en/model-config#block-specific-models-or-versions)
