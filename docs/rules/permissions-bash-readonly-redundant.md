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

The docs say that some arguments still prompt. So the rule checks less than the row:

- `find` and `cd` get a report for the bare command only. `find` with an action such as `-exec`, `-delete` or `-fprint`, or with
  `-files0-from`, still prompts. A glob that is not quoted prompts too. `cd` to a path out of the working directories prompts.
  A prefix rule such as `Bash(find *)` or `Bash(cd *)` can approve a call that prompts otherwise.[^read-only]
- A rule with more words than the command, as `Bash(cat /etc/hosts)`, is silent. The rule does not judge the arguments.

The rule is silent for a `deny` or `ask` rule, which asks for a prompt on purpose. It is silent for an allow rule that a deny or
ask rule covers: [`permissions-dead-allow`](permissions-dead-allow.md) reports that rule.

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
