---
type: Reference
description: The ESLint rule claude/settings-project-value-ignored, which reports a value in .claude/settings.json or .claude/settings.local.json that Claude Code ignores there, such as remoteControlAtStartup true, crossSessionInbound accept, forceLoginMethod gateway, a ccpool_ environment ID, and tip objects in spinnerTipsOverride.
owner: brianespinosa
created: 2026-10-08
related_issues: [14]
stale_after: 2027-04-08
generated:
  by: claude-code
  at: 2026-10-08T00:00:00Z
---

# `settings-project-value-ignored`

Do not set a value in a project settings file that Claude Code ignores there.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

## Rule details

A repository must not steer some behavior of a session. For a few keys, Claude Code reads a
value from user, managed and `--settings` sources, and ignores or limits the same value in a
project or local file.[^exceptions] The rule reports each such value. The report is on the value,
or on the key for the tip keys.

| Key and value | What Claude Code does in a project or local file |
|---------------|--------------------------------------------------|
| `remoteControlAtStartup: true` | Ignores it. A repository can turn auto-connect off, and cannot turn it on[^remote] |
| `isolatePeerMachines: false` | A `true` from any file applies, so a project file can turn the requirement on and not off[^isolate] |
| `disableClaudeAiConnectors: false` | A `true` in any file applies, and a project `false` cannot override it. The value is the same as unset[^connectors] |
| `crossSessionInbound: "accept"` | Applies a project value only when it is stricter than the value from managed, `--settings` or user settings. `accept` is the least strict[^inbound] |
| `forceLoginMethod: "gateway"` | Treats it as unset. Only a managed source on the machine can set it[^login] |
| `remote.defaultEnvironmentId` that starts with `ccpool_` | Ignores a self-hosted environment ID. It reads one from user settings, managed settings and `--settings` only[^environment] |
| A tip object in `spinnerTipsOverride.tips`, and the keys `tipsFile`, `label` and `excludeDefault` | Reads plain string tips only[^tips] |

The `isolatePeerMachines` and `disableClaudeAiConnectors` messages say that the value has no
effect. A project `false` is the same as no value, or loses to a `true` from another file.

The rule lints the two project files. The managed files can set each of these values, and the
rule does not read them. A hidden file in `managed-settings.d/` is not a project file.

### What the rule does not check

- `bashEditDiffEnabled: true`. Claude Code ignores it in a project file, and `settings-key-scope`
  reports it, so the fault gets one report.[^bash]
- `forceLoginOrgUUID`. A single UUID in a project file does have an effect. It pre-selects the
  organization at login, and stops the keyless Console sign-in. Only a managed source enforces
  the restriction.[^org]
- A value of another type than the one in the table. `settings-schema` is for it.
- A tip entry that is not a string or an object.
- A user settings file, or a file passed with `--settings`.

When a file has two keys of one name, the rule reads the last, as `JSON.parse` does.

Fail, in `.claude/settings.json`:

```json
{
  "remoteControlAtStartup": true,
  "crossSessionInbound": "accept",
  "spinnerTipsOverride": {
    "label": "Acme tip",
    "tips": [{ "id": "review", "text": "Run /review before a PR" }]
  }
}
```

Pass:

```json
{
  "remoteControlAtStartup": false,
  "crossSessionInbound": "hold",
  "spinnerTipsOverride": {
    "tips": ["Run /review before a PR"]
  }
}
```

## Sources

[^exceptions]: [Settings files and precedence: Exceptions to managed settings precedence](https://code.claude.com/docs/en/settings#exceptions-to-managed-settings-precedence)
[^remote]: [All settings: remoteControlAtStartup](https://code.claude.com/docs/en/settings-reference#remotecontrolatstartup)
[^isolate]: [All settings: isolatePeerMachines](https://code.claude.com/docs/en/settings-reference#isolatepeermachines)
[^connectors]: [All settings: disableClaudeAiConnectors](https://code.claude.com/docs/en/settings-reference#disableclaudeaiconnectors)
[^inbound]: [All settings: crossSessionInbound](https://code.claude.com/docs/en/settings-reference#crosssessioninbound)
[^login]: [All settings: forceLoginMethod](https://code.claude.com/docs/en/settings-reference#forceloginmethod)
[^environment]: [All settings: remote.defaultEnvironmentId](https://code.claude.com/docs/en/settings-reference#remote-defaultenvironmentid)
[^tips]: [All settings: spinnerTipsOverride](https://code.claude.com/docs/en/settings-reference#spinnertipsoverride)
[^bash]: [All settings: bashEditDiffEnabled](https://code.claude.com/docs/en/settings-reference#basheditdiffenabled)
[^org]: [All settings: forceLoginOrgUUID](https://code.claude.com/docs/en/settings-reference#forceloginorguuid)
