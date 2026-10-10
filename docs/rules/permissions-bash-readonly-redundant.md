---
type: Reference
description: The ESLint rule claude/permissions-bash-readonly-redundant, which reports a Bash allow rule for a built-in read-only command such as ls or cat, because Claude Code runs these commands without a prompt.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-bash-readonly-redundant`

Do not write a Bash allow rule for a read-only command that runs without a prompt.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. It is a heuristic, so `strict` turns it on at `warn`.
The rule also lints the managed settings files: `managed-settings.json` and each `managed-settings.d/*.json` drop-in.
It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

Claude Code treats a built-in set of Bash commands as read-only. It runs them without a prompt in every mode. The set includes
`ls`, `cat`, `echo`, `pwd`, `head`, `tail`, `grep`, `find`, `wc`, `which`, `diff`, `stat`, `du` and `cd`.[^read-only] The set is not
configurable. To require a prompt for one of these commands, add an `ask` or a `deny` rule.[^read-only]

The rule reports an `allow` entry for `Bash` or `Monitor`. The entry names one of these commands alone (`Bash(ls)`), or with a
final `*` (`Bash(ls *)`, `Bash(ls:*)`). The rule leaves out `git`: the docs name no form of it.

The docs say that some arguments still prompt. So the rule checks less than issue 15 asks for:

- `find` and `cd` get a report for the bare command only. `find` with a glob that is not quoted still prompts.
  `cd` to a path out of the working directories prompts. A prefix rule for them is not a plain copy of the built-in set.[^read-only]
- A rule with more words than the command, as `Bash(cat /etc/hosts)`, is silent. The rule does not judge the arguments.

The rule is silent for a `deny` or `ask` rule, which asks for a prompt on purpose. It is silent for an allow rule with the same
text as a deny or ask rule, or a deny or ask rule for the bare tool. [`permissions-dead-allow`](permissions-dead-allow.md)
reports that rule. A deny rule with a wider pattern, as `Bash(ls *)` against `Bash(ls)`, gives a report from both rules.

The docs give two exceptions to "without a prompt". `permissions.blockReadsOutsideWorkingDirectories` changes the paths outside
the working directories. In Manual mode, some cases still prompt. The rule does not read these cases.[^read-only]

The list is in `src/data/bash-commands.ts`, and `tests/bash-commands.test.ts` pins it to the sentence of the docs.

Fail:

```json
{ "permissions": { "allow": ["Bash(ls)", "Bash(cat *)"] } }
```

Pass:

```json
{ "permissions": { "allow": ["Bash(npm test)"] } }
```

## Options

None.

## Sources

[^read-only]: [Configure permissions: Read-only commands](https://code.claude.com/docs/en/permissions#read-only-commands)
