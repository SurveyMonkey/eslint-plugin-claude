---
type: Reference
description: The ESLint rule claude/permissions-auto-mode-defaults, which reports an autoMode environment, allow, soft_deny or hard_deny array in a managed settings file that has no "$defaults" entry, because the array then replaces the built-in rules of its section.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-auto-mode-defaults`

Keep the built-in auto mode rules with `"$defaults"` in each `autoMode` array.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | security | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule reads managed files only. It skips a hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

Setting any of `environment`, `allow`, `soft_deny` or `hard_deny` without `"$defaults"` replaces the whole default list
of that section.[^override] The loss differs by list:

- `soft_deny`: every built-in soft block rule, including force push, `curl | bash`, production deploys, and auto-mode bypass.[^override]
- `hard_deny`: the built-in data exfiltration rule.[^override]
- `environment`: the built-in context, trust and sensitivity slots.[^trusted]
- `allow`: the built-in exceptions to the soft block rules.[^override]

The Danger block of the docs names the `soft_deny` and `hard_deny` loss. Its first sentence covers all four lists. Claude
Code writes the `environment` list of its own draft with no `"$defaults"`, so a managed copy of that draft is reported.

The rule reports the array that has no `"$defaults"` entry. An empty array has none, so the rule reports it. The docs say
to leave out `"$defaults"` only to own the whole list.[^override] The rule gives a warning for that choice.

### Scope

The classifier reads `autoMode` from user settings, managed settings and the `--settings` flag. It does not read `autoMode`
from `.claude/settings.json` or `.claude/settings.local.json`.[^where] So the rule reads managed files only. A project file
is for `settings-key-scope`, which reports the key there. A user file is outside the repository, so the rule does not read it.

Claude Code adds up the entries of one array over the files that set it.[^automode] So the rule reads the managed source:
`managed-settings.json` and the files of `managed-settings.d/`. An entry `"$defaults"` in the same list of any file of the
source keeps the built-in rules, and the rule gives no report. The rule gives no report when it cannot read a file of the
source, because that file can hold the entry. A user file can hold it too, but the rule cannot see it.

A list that is not an array is for `permissions-auto-mode-schema`.

Fail, in `managed-settings.json`:

```json
{ "autoMode": { "soft_deny": ["Never run terraform apply"] } }
```

Pass, in `managed-settings.json`:

```json
{ "autoMode": { "soft_deny": ["$defaults", "Never run terraform apply"] } }
```

## Options

None.

## Sources

[^override]: [Configure auto mode: Override the block and allow rules](https://code.claude.com/docs/en/auto-mode-config#override-the-block-and-allow-rules)
[^trusted]: [Configure auto mode: Define trusted infrastructure](https://code.claude.com/docs/en/auto-mode-config#define-trusted-infrastructure)
[^where]: [Configure auto mode: Where the classifier reads configuration](https://code.claude.com/docs/en/auto-mode-config#where-the-classifier-reads-configuration)
[^automode]: [All settings: autoMode](https://code.claude.com/docs/en/settings-reference#automode)
