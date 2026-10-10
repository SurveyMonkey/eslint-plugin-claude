---
type: Reference
description: The ESLint rule claude/skill-side-effects-manual-only, which reports a skill or command that Claude can invoke on its own and whose allowed-tools or injected commands have a side effect, such as git push, with its option, examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [50]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `skill-side-effects-manual-only`

Let only the user invoke a skill that has side effects.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/SKILL.md`, `**/commands/**/*.md` |

The rule is `off` in `recommended`. The rule is a heuristic: it matches words in text.

## Rule details

By default, Claude can load any skill when it thinks the skill is relevant. The docs say to set
`disable-model-invocation: true` for workflows with side effects, such as `/commit` and
`/deploy`. Then Claude cannot decide to deploy because the code looks ready.[^invoke] The
features page gives the same advice.[^load]

The rule reports a skill or command that has a side effect and does not set the field. It looks
for the default patterns `git push`, `git commit`, `deploy` and `send message`. Each pattern is
a run of words, in order. The match ignores letter case. A path or a name joins words with
`/`, `:`, `=`, `.` or `_`, so `./scripts/deploy.sh` and `send_message` both match. A longer word
such as `deploy-status` does not match. The rule reads two places:

- The `Bash` rules in `allowed-tools`, such as `Bash(git push *)`. A rule that grants a whole
  tool, such as `Bash` or `Bash(*)`, has no pattern, so it does not match. A rule in
  `disallowed-tools` does not match.
- The injected commands, in the inline form and in a ```` ```! ```` fence. The rule splits a
  command at `&&`, `||`, `;`, `|` and a line break. It skips a quoted string, a comment line, and
  a command that only prints or reads, such as `echo deploy` or `grep deploy notes.md`.

The report is on the first match in the file. It is on the `allowed-tools` rule or on the
injected command.

The rule stays silent in these cases:

- The skill sets `disable-model-invocation: true`.
- The skill sets `user-invocable: false`. Only Claude can invoke that skill. The field
  `disable-model-invocation: true` would make it unreachable. See
  [`skill-invocation-unreachable`](skill-invocation-unreachable.md).
- The frontmatter does not parse. The rule cannot read the fields.

The rule checks a `SKILL.md` in a project and in a plugin, and a command file. It does not know
what a command does. A skill that runs `make deploy` as a dry run is a false report. Turn the
rule off for that file.

Fail:

```markdown
---
description: Publish the release
allowed-tools: Bash(git push *)
---

Push the tag and tell the team.
```

Pass:

```markdown
---
description: Publish the release
disable-model-invocation: true
allowed-tools: Bash(git push *)
---

Push the tag and tell the team.
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `patterns` | `[]` | More patterns. Each has at least one letter or digit. The rule adds them to the default patterns. |

```js
'claude/skill-side-effects-manual-only': ['warn', { patterns: ['terraform apply', 'kubectl delete'] }]
```

The `recommended` and `strict` configs set no option.

## Sources

[^invoke]: [Extend Claude with skills: Control who invokes a skill](https://code.claude.com/docs/en/skills#control-who-invokes-a-skill)
[^load]: [Extend Claude Code: Understand how features load](https://code.claude.com/docs/en/features-overview#understand-how-features-load)
