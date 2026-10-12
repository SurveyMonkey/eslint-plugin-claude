---
type: Reference
description: The ESLint rule claude/permissions-deny-secret-files, a heuristic that reports a project whose git index tracks a .env file, a .env.* file or a secrets folder that no Read deny rule of the project settings covers.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# claude/permissions-deny-secret-files

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| security | `**/.claude/settings.json` |

The rule is `off` in `recommended`. It is a heuristic, so `strict` turns it on at `warn`.

## Rule details

The docs use `permissions.deny` for files that hold API keys, secrets or environment values. Their example denies `Read(./.env)`,
`Read(./.env.*)` and `Read(./secrets/**)`.[^deny] A `Read` deny rule also blocks the Edit and Write tools on the same path.[^read]

The rule lints the shared file `.claude/settings.json`. It asks the git index, through `src/git-state.ts`, for the files that the
project tracks. The project is the folder that holds `.claude/`. The rule looks for:

- a tracked file `.env`, or a tracked file whose name starts with `.env.`, in that folder
- a tracked file below `secrets/` in that folder

It reports the items that no `Read` deny rule covers, in one report on the `permissions` value. A rule covers an item when its
gitignore pattern matches the path or a directory above it.[^read] The rule counts the deny lists of both project files.
A `Read` deny rule with no specifier covers every file. The report names the rules of the docs example that fit the items.

### What the rule does not read

- A file that git does not track, and a file that is not there. A `.env` that stays out of git is not in the repository
  (ADR 001, Decision 14). With no `.git`, or when git cannot answer, the rule makes no report.
- A placeholder file: a name that ends in `.example`, `.sample` or `.template`. The docs name none of them. This is the choice
  of the plugin, because such a file holds no value.
- A `.env` file or a `secrets` folder below the project folder. The index lists the files of the folder only.
- A deny rule in a user or managed file, and the sandbox `denyRead` setting. They are not visible here, which is why the rule is
  `off` in `recommended`. A pattern that starts with `//` or `~/` cannot be placed in the project, so it covers nothing here.
  A pattern with a bracket expression may cover the path, so the rule makes no report.
- The local file and the managed files. The shared file speaks for the project.

The rule is silent when it cannot read the other project file, because that file can hold the deny rule.

Fail, when git tracks `.env`:

```json
{ "permissions": { "allow": ["Bash(npm test)"] } }
```

Pass:

```json
{ "permissions": { "deny": ["Read(./.env)", "Read(./.env.*)", "Read(./secrets/**)"] } }
```

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/permissions-deny-secret-files': 'warn'
```

## Sources

[^deny]: [All settings: permissions.deny](https://code.claude.com/docs/en/settings-reference#permissionsdeny)
[^read]: [Configure permissions: Read and Edit](https://code.claude.com/docs/en/permissions#read-and-edit)
