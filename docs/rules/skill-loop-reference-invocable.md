---
type: Reference
description: The ESLint rule claude/skill-loop-reference-invocable, which reports a .claude/loop.md that starts with a skill or command that sets disable-model-invocation, because a scheduled fire passes it to Claude as plain text, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [50]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `skill-loop-reference-invocable`

Do not start `loop.md` with a skill that only the user can invoke.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | no-op | `**/.claude/loop.md` |

The rule is `off` in `recommended`. The rule is a heuristic, and it reads other files.

## Rule details

The file `.claude/loop.md` is the default prompt of a bare `/loop`. The docs say to write it as
if you typed the `/loop` prompt directly.[^loop] A prompt can be a skill, such as
`/loop 20m /review-pr 1234`. But a scheduled fire runs only the skills that Claude can invoke on
its own. A skill with `disable-model-invocation: true` reaches Claude as plain text and does
not run.[^loop] The field has the same effect when a scheduled task fires with the skill as its
prompt.[^field]

The rule reads the first line that is not blank. When that line starts with `/` and a name, the
rule looks for the skill or command file of that name in the same `.claude/` folder. It reports
when that file sets `disable-model-invocation: true`. The report is on the `/name` token.

- A skill folder is found by its folder name and by its `name` field.
- A command file is found by its path, with `:` for each folder.
- A skill wins over a command file of the same name.
- The rule reads the folder `.claude/` of the file and no folder above or beside it. It does
  not read a file with a real path out of the repository.

The rule makes no report in these cases:

- The name matches no file in the folder. A built-in command, a plugin skill and a skill in
  another folder match none.
- The rule cannot read a file that may answer to the name. This includes an unreadable file, a
  link to nothing and a link out of the repository.
- Two files answer to the name, and one of them is not manual only.
- The line starts with other text. A name inside a sentence goes to Claude as text. The rule does
  not judge that case.

Fail, in `.claude/loop.md`, with `.claude/skills/deploy/SKILL.md` that sets
`disable-model-invocation: true`:

```markdown
/deploy test
```

Pass, with a `.claude/skills/review/SKILL.md` that Claude can invoke:

```markdown
/review 1234
```

## Sources

[^loop]: [Run prompts on a schedule: Run a prompt repeatedly with /loop](https://code.claude.com/docs/en/scheduled-tasks#run-a-prompt-repeatedly-with-loop)
[^field]: [Extend Claude with skills: Frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)
