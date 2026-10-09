---
type: Reference
description: The ESLint rule claude/settings-key-scope, which reports a settings key in a file that Claude Code does not read it from, such as a managed-only key in .claude/settings.json or a Global config key in any settings file, from the scope data in src/data/settings-keys.ts.
owner: brianespinosa
created: 2026-10-08
related_issues: [14]
stale_after: 2027-04-08
generated:
  by: claude-code
  at: 2026-10-08T00:00:00Z
---

# `settings-key-scope`

Set each settings key in a file that Claude Code reads it from.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

The settings index gives each key a Scope. The Scope says which files Claude Code reads the key
from.[^index] Claude Code ignores a key in a repository file outside its Scope.[^committed] The
rule reports a key that the file cannot set. The report is on the key.

| Scope | Where Claude Code reads the key | The rule reports it in |
|-------|---------------------------------|------------------------|
| `Managed` | Managed settings only[^managed] | `.claude/settings.json`, `.claude/settings.local.json` |
| `User or managed` | User and managed settings | `.claude/settings.json`, `.claude/settings.local.json` |
| `User, local, or managed` | User, local and managed settings | `.claude/settings.json` |
| `Global config` | `~/.claude.json` only[^global] | Each file, a managed file too |
| `Any file` | Each settings file | No file |

The managed files are `managed-settings.json` and the `*.json` files in `managed-settings.d/`.
User settings files are not in a repository, so the rule does not read them.

A nested key has a dotted name in the index, such as `sandbox.network.allowManagedDomainsOnly`.
The rule reads an object only when the index lists a key below it. A key that has a listed key
below it gets one report, on the key. The rule does not report the keys below it.

A top-level key with a dot in its name is one key. It is not a nested key.

The data is in `src/data/settings-keys.ts`, with the Claude Code version and the date of the last
review. The data module also holds the three exceptions below.

### Exceptions

- **`syncClaudeAiPlugins`.** The rule makes no report on this key. The rule
  `settings-sync-claude-ai-plugins` reports it in `.claude/settings.json`, so one fault gets one
  report. Its Scope is `User, local, or managed`.
- **`autoContinueAtUsageLimit`.** The rule makes no report on this key. Its Scope is `User or
  managed`. But when no user, `--settings` or managed file sets the key, a value in a project or
  local file turns the feature off. Claude Code does not ignore it.[^autocontinue] The rule
  `settings-project-autocontinue-off` is for this key.
- **`bashEditDiffEnabled`.** Its Scope is `User or managed`. A `true` in a project or local file
  does not count. A `false` in those files still turns the feature off.[^bash] So the rule
  reports a `true`, and makes no report on a `false`. It makes no report on a value that is not a
  Boolean.

The keys `syncClaudeAiSkills` and `useAutoModeDuringPlan` have the Scope `User, local, or
managed`. Claude Code honors a `false` in `.claude/settings.local.json`. It ignores a `false` in
`.claude/settings.json`.[^exceptions] So the rule reports these keys in `.claude/settings.json` for
any value.

### Aliases

Claude Code reads `additionalMarketplaces` as `extraKnownMarketplaces`, and `allowedMarketplaces`
as `strictKnownMarketplaces`, in each file that accepts the canonical key.[^aliases] The rule
gives an alias the Scope of its canonical key. So `allowedMarketplaces` is `Managed`. The key
`permissions.disableAutoMode` is an accepted form of `disableAutoMode`, with the Scope `Any
file`.[^disableautomode]

### What the rule does not check

- A key that the index does not list. That is for `settings-schema`.
- A value. The rule reads key names only, apart from the `true` of `bashEditDiffEnabled`.
- A file passed with `--settings`. The rule reads the settings files of a repository by name.

When a file has two keys of one name, the rule reads the last, as `JSON.parse` does.

Fail, in `.claude/settings.json`:

```json
{
  "allowManagedHooksOnly": true,
  "sandbox": {
    "network": { "allowManagedDomainsOnly": true }
  }
}
```

Pass, in `managed-settings.json`:

```json
{
  "allowManagedHooksOnly": true,
  "sandbox": {
    "network": { "allowManagedDomainsOnly": true }
  }
}
```

## Sources

[^index]: [All settings: Settings index](https://code.claude.com/docs/en/settings-reference#settings-index)
[^committed]: [Settings files and precedence: A committed key doesn't reach teammates](https://code.claude.com/docs/en/settings#a-committed-key-doesnt-reach-teammates)
[^managed]: [Deploy managed settings: Keys only a managed source can set](https://code.claude.com/docs/en/managed-settings#keys-only-a-managed-source-can-set)
[^global]: [All settings: Global config settings](https://code.claude.com/docs/en/settings-reference#global-config-settings)
[^exceptions]: [Settings files and precedence: Exceptions to managed settings precedence](https://code.claude.com/docs/en/settings#exceptions-to-managed-settings-precedence)
[^bash]: [All settings: bashEditDiffEnabled](https://code.claude.com/docs/en/settings-reference#basheditdiffenabled)
[^autocontinue]: [All settings: autoContinueAtUsageLimit](https://code.claude.com/docs/en/settings-reference#autocontinueatusagelimit)
[^aliases]: [All settings: Marketplace key aliases](https://code.claude.com/docs/en/settings-reference#marketplace-key-aliases)
[^disableautomode]: [All settings: disableAutoMode](https://code.claude.com/docs/en/settings-reference#disableautomode)
