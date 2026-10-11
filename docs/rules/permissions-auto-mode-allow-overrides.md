---
type: Reference
description: The ESLint rule claude/permissions-auto-mode-allow-overrides, a heuristic that reports a managed autoMode.soft_deny entry that states a rule without exception, because a developer allow entry or a direct request of the user can override a soft block, and only hard_deny and permissions.deny hold.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-auto-mode-allow-overrides`

Do not rely on a managed `soft_deny` entry as a hard boundary, because an `allow` entry can override it.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | security | `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. It is a heuristic, so `strict` turns it on at `warn`.
The rule reads no hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

Entries from each scope of `autoMode` combine. A developer can add entries but cannot remove those of managed settings. Inside the
classifier, an `allow` entry is an exception to a `soft_deny` entry, so a developer `allow` entry "can override an organization
`soft_deny` entry: the combination is additive, not a hard policy boundary".[^where] A direct request of the user also clears a
soft block.[^tiers] `hard_deny` blocks without exception, and `permissions.deny` in managed settings blocks before the classifier
and cannot be overridden.[^where][^tiers]

A file does not show what the author means by an entry. The rule reads the wording. It reports a string entry of `autoMode.soft_deny`
that holds `never`, `must not`, `under no circumstances` or `no exceptions`, in any letter case. The message says that the entry
can be overridden, and names the two fixes. `hard_deny` takes prose entries as `soft_deny` does. `permissions.deny` takes a tool
pattern.

### Limits

The rule is noisy by design. The docs example of `soft_deny` holds the entry "Never modify files under infra/terraform/prod/:
production infrastructure changes go through the review workflow", and the docs call a `soft_deny` entry the way to add
"destructive risks specific to your environment".[^tiers] A team that wants a soft block and a clear request to override it gets
a report on such an entry. That is the reason the rule is `off` in `recommended`.

The rule reads the managed files only. The classifier reads `autoMode` from user settings, managed settings and the `--settings`
flag, and not from the two project files.[^where] A user file is outside the repository (ADR 001, Decision 14). The rule reads the
`soft_deny` list of the linted file. It does not check the `allow` entries of a developer, which the repository does not hold.
The `$defaults` entry and the entries of the other lists get no report.

Fail:

```json
{ "autoMode": { "soft_deny": ["$defaults", "Never push to the release branch"] } }
```

Pass:

```json
{ "autoMode": { "hard_deny": ["$defaults", "Never push to the release branch"] } }
```

## Options

None.

## Sources

[^where]: [Configure auto mode: Where the classifier reads configuration](https://code.claude.com/docs/en/auto-mode-config#where-the-classifier-reads-configuration)
[^tiers]: [Configure auto mode: Override the block and allow rules](https://code.claude.com/docs/en/auto-mode-config#override-the-block-and-allow-rules)
