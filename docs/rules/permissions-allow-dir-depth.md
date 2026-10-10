---
type: Reference
description: The ESLint rule claude/permissions-allow-dir-depth, which reports a Read or Edit allow rule with a one-directory pattern such as src/**, because it matches only the directory under the current directory, while the same pattern in deny or ask matches at any depth.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-allow-dir-depth`

Write the depth of a one-directory `allow` pattern for `Read` and `Edit`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule reads no hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

A relative pattern with one directory segment, such as `src/**`, matches at a different depth for each rule type.[^read]
In an `allow` rule, `Edit(src/**)` matches only `<cwd>/src` and the files under it. In a `deny` or `ask` rule, the same
pattern matches a directory named `src` at any depth under the current directory. To allow a directory name at any depth,
write `Edit(**/src/**)`.[^read] To name one directory, write `Edit(/src/**)`.[^read]

The rule reports a `Read` or `Edit` rule in `allow` whose pattern is one directory name and a final `/**`. A person who writes
`Edit(src/**)` in `allow` can expect the depth of the same pattern in `deny`. The message offers `/src/**` and `**/src/**`.

The docs give no Claude Code version for the split by rule type, so the rule has no version option.

### What the rule does not check

- A pattern with a `./` start, such as `Edit(./src/**)`. The docs name the depth rule for `src/**` only.
- A pattern with more than one segment (`src/components/**`), a wildcard in the directory name (`s*/**`), a final `/*`,
  and a pattern that starts with `/`, `~/` or `//`. These match at one depth in every rule type.[^read]
- A `deny` or `ask` rule, and a `Write`, `Glob` or `NotebookEdit` path rule. `permissions-path-rule-tool` reads the last three.
- A rule in a skill file. The rule reads settings files only.

Fail:

```json
{ "permissions": { "allow": ["Edit(src/**)"] } }
```

Pass:

```json
{ "permissions": { "allow": ["Edit(/src/**)", "Edit(**/docs/**)"], "deny": ["Edit(secrets/**)"] } }
```

## Options

None.

## Sources

[^read]: [Configure permissions: Read and Edit](https://code.claude.com/docs/en/permissions#read-and-edit)
