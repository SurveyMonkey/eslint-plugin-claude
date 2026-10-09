---
type: Reference
description: "The ESLint rule claude/skill-fork-fields-require-context, which reports an agent or background field in a skill or command file that does not set context: fork, because Claude Code then ignores both fields."
owner: brianespinosa
created: 2026-09-30
related_issues: [8]
stale_after: 2027-03-30
generated:
  by: claude-code
  at: 2026-09-30T00:00:00Z
---

# `skill-fork-fields-require-context`

Set `agent` and `background` only with `context: fork`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/SKILL.md`, `**/commands/**/*.md` |

## Rule details

`context: fork` runs a skill in a forked subagent.[^fork] `agent` picks the type of that
subagent. `background` sets if the caller waits for it. Both fields apply only with
`context: fork`.[^reference] Without it, Claude Code ignores them and shows no error.

The rule reports each of `agent` and `background` that has a value, when `context` is not
`fork`. The report is on the key. A key with no value is the same as an absent key.

The rule ignores a file with no frontmatter, and a file whose frontmatter does not parse.

The rule checks the files that the other skill rules check:

- `.claude/skills/<name>/SKILL.md`
- `<plugin>/skills/<name>/SKILL.md`
- `<plugin>/SKILL.md`
- `.claude/commands/**/*.md`
- `<plugin>/commands/**/*.md`

A file elsewhere, such as `docs/SKILL.md`, is not a report. A plugin root is a directory with
`.claude-plugin/plugin.json`.

Fail:

```markdown
---
description: Summarizes a pull request.
agent: Explore
---
```

Pass:

```markdown
---
description: Summarizes a pull request.
context: fork
agent: Explore
---
```

## Options

None.

## Sources

[^reference]: [Extend Claude with skills: Frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)
[^fork]: [Extend Claude with skills: Run skills in a subagent](https://code.claude.com/docs/en/skills#run-skills-in-a-subagent)
