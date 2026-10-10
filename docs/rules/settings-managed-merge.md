---
type: Reference
description: The ESLint rule claude/settings-managed-merge, which reports managedSourcesBehavior merge in a drop-in of managed-settings.d, because Claude Code reads the key from the highest-priority source. It is off in recommended.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-managed-merge`

Set `managedSourcesBehavior` in the highest-priority managed source.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | no-op | `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. It is a heuristic. `strict` turns it on at `warn`.

## Rule details

`managedSourcesBehavior: "merge"` makes Claude Code apply every managed source that delivers a policy, not
only the highest one. Claude Code then adds the entries of a lower source to the policy, such as
`permissions.allow` rules and hooks. Use it only when an administrator controls every lower source.[^key][^compose]

Claude Code reads the key from the highest-priority source that carries it or a policy key.[^key] It
ignores the key in each lower source. The files of `managed-settings.json` and `managed-settings.d/` are
one source. It ranks below server-managed settings and MDM.[^combine][^split] The settings reference says: "A `managed-settings.json` file is the lowest-ranked admin source, so `"merge"`
set there has no source below it to combine with."[^key] The same holds for a drop-in. So a `merge` in a
drop-in combines nothing. The rule reports the value `"merge"` in a drop-in.

`settings-managed-file` owns the same key in `managed-settings.json`. The file globs list that file. The rule
reports nothing there, so the two rules never report the same node.

### What the rule does not check

- `managed-settings.json`. `settings-managed-file` reports it.
- A hidden file in `managed-settings.d/`, which Claude Code ignores.
- Another value, and a value that is not a string. `settings-schema` reports a value that is not
  allowed.
- A source outside the repository: server-managed settings, an MDM profile, the registry.

The rule reads only the linted file. It needs no other file of the managed source.

Fail:

```json
{
  "managedSourcesBehavior": "merge"
}
```

Pass: set the key in the highest-priority source that you deploy, such as server-managed settings.

## Sources

[^key]: [All settings: managedSourcesBehavior](https://code.claude.com/docs/en/settings-reference#managedsourcesbehavior)
[^compose]: [Deploy managed settings: Compose every managed source](https://code.claude.com/docs/en/managed-settings#compose-every-managed-source)
[^combine]: [Deploy managed settings: How Claude Code combines managed sources](https://code.claude.com/docs/en/managed-settings#how-claude-code-combines-managed-sources)
[^split]: [Deploy managed settings: Split a file-based policy across teams](https://code.claude.com/docs/en/managed-settings#split-a-file-based-policy-across-teams)
