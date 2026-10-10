---
type: Reference
description: The ESLint rule claude/permissions-negation, which reports a ! rule in a Read or Edit deny or ask list that Claude Code cannot honor, such as a bare !, a ! listed first, a ! before a /, ~/ or // anchor, or a ! inside a directory that an earlier rule blocks whole.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-negation`

Write a `!` rule after the path rule that it carves, and not before an anchor.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule also lints the managed settings files: `managed-settings.json` and each `managed-settings.d/*.json` drop-in.
It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

A `Read` or `Edit` deny or ask pattern that starts with `!` is a gitignore negation. It carves the paths that it matches
out of the `path` or `./path` rules listed before it. In one `deny` list, `Read(*.env)` followed by
`Read(!sample.env)` blocks every `.env` file except `sample.env`. The carve-out reaches only rules from the same
source.[^read]

The rule reports a `!` rule in four cases. Each report names the rule:

- **A bare `!`**, as in `Read(!)`. The changelog of Claude Code says that a bare `!` negation is ignored. It records
  this under 2.1.269. The live docs page of the changelog is too large to cite. Read the entry in the
  [changelog file](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md).
- **A `!` before an anchor**, as in `Read(!~/notes/public/**)`. Claude Code reads a `!` pattern relative to the current
  directory, even when `/`, `~/` or `//` follows the `!`. So it cannot reach a rule that starts with one of those
  anchors.[^read] The rule checks this case before the next.
- **A `!` that carves nothing.** A `!` rule listed first carves nothing out.[^read] The rule reports a `!` rule when no
  rule of the form `path` or `./path` comes before it in the same list. A rule that starts with `/`, `~/` or `//` does not
  count, because a `!` pattern cannot reach it.
- **A `!` inside a directory that an earlier rule blocks whole.** With `Read(secrets/**)` and
  `Read(!secrets/public/**)`, Claude Code still blocks `secrets/public`.[^read] The rule reports a `!` path that is
  inside the directory of an earlier `<directory>/**` rule. It drops a `./` at the start of each path. It does not build a
  gitignore matcher, so `**/secrets/**` and `secrets/*.md` are not directories that it can name.

A `!` rule after a rule it can carve is silent. That includes `Read(*.env)` then `Read(!sample.env)`, the example of the
docs. The rule reads the list of the rule, so a rule in `ask` does not count for a `!` rule in `deny`. A `Read` rule and an
`Edit` rule count for each other, because the docs say "the `path` or `./path` rules" and name no tool pair.

The rule does not read these:

- An `allow` rule. The docs describe the `!` form for deny and ask patterns only.
- A rule for another tool. A `Cd` rule does not use gitignore syntax.[^cd]
- A parameter rule in `deny` or `ask`, as in `Read(offset:5)`. [`permissions-param-rule`](permissions-param-rule.md)
  reads those. A parameter rule is not a path rule, so it does not count as an earlier rule.
- A string that does not parse. [`permissions-rule-syntax`](permissions-rule-syntax.md) reports it.
- A `!` rule that is also an unusable pattern. [`permissions-invalid-path-pattern`](permissions-invalid-path-pattern.md)
  reports an unclosed `[` in the pattern, and this rule reports the position of the `!`.

The rule makes one report for each `!` rule. It reads the last of two keys of one name, as `JSON.parse` does, and
it skips an entry that is not a string.

Fail:

```json
{ "permissions": { "deny": ["Read(!sample.env)", "Read(*.env)", "Read(secrets/**)", "Read(!secrets/public/**)"] } }
```

Pass:

```json
{ "permissions": { "deny": ["Read(*.env)", "Read(!sample.env)"] } }
```

## Options

None.

## Sources

[^read]: [Configure permissions: Read and Edit](https://code.claude.com/docs/en/permissions#read-and-edit)
[^cd]: [Configure permissions: Cd](https://code.claude.com/docs/en/permissions#cd)
