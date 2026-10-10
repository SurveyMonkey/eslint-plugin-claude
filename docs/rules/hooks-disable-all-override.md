---
type: Reference
description: The ESLint rule claude/hooks-disable-all-override, which reports disableAllHooks false in the committed .claude/settings.json, because it overrides a true in the user settings.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-disable-all-override`

Do not set `disableAllHooks` to `false` in the committed project settings.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | security | `**/.claude/settings.json` |

## Rule details

Claude Code reads the value of `disableAllHooks` that is left after settings precedence. The project file is
above the user file. So a `"disableAllHooks": false` in a project `.claude/settings.json` overrides a `true` in
the user settings. This holds for each person who clones the repository.[^disable] A person who turned hooks off, to review an
unknown repository, then gets the hooks of that repository again. Hooks run with the permissions of the user.
A project hook also runs in a `claude -p` session, which shows no trust dialog.[^trust]

The rule reports `"disableAllHooks": false` in the committed project file. It reports at the value. It reads the
last of two members of the same name, as `JSON.parse` does. A `true`, a missing key and a value of another type
get no report.

The rule reads `.claude/settings.json` only. It reads no `.claude/settings.local.json`, because that file is the
person's own. It reads no managed file, because an administrator sets the policy there. Only a managed
`disableAllHooks` can turn off managed hooks.[^disable] The rule
[`hooks-disabled-by-disableallhooks`](hooks-disabled-by-disableallhooks.md) reports the opposite fault, a `true`
beside `hooks`.

Fail, in `.claude/settings.json`:

```json
{
  "disableAllHooks": false,
  "hooks": {}
}
```

Pass: remove the key.

```json
{
  "hooks": {}
}
```

## Sources

[^disable]: [Hooks reference: Disable or remove hooks](https://code.claude.com/docs/en/hooks#disable-or-remove-hooks)
[^trust]: [Configure permissions: What runs before you trust a folder](https://code.claude.com/docs/en/permissions#what-runs-before-you-trust-a-folder)
