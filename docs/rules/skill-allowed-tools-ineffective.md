---
type: Reference
description: The ESLint rule claude/skill-allowed-tools-ineffective, which reports EndConversation in disallowed-tools and AskUserQuestion in allowed-tools in a skill or command file, because neither entry has an effect.
owner: brianespinosa
created: 2026-09-30
related_issues: [8]
stale_after: 2027-03-30
generated:
  by: claude-code
  at: 2026-09-30T00:00:00Z
---

# `skill-allowed-tools-ineffective`

Do not list a tool in a field that does not affect it.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/SKILL.md`, `**/commands/**/*.md` |

## Rule details

Two entries have no effect:

- `EndConversation` in `disallowed-tools`. Like a deny rule, the field cannot remove this tool
  while any other tool remains.[^reference][^endconversation]
- `AskUserQuestion` in `allowed-tools`. The field pre-approves a tool.[^preapprove] Claude Code
  does not auto-allow an interactive tool that a skill lists. The changelog of Claude Code records
  this fix under 2.1.69. The live docs page of the changelog does not hold that entry. Read it in
  the [changelog file](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md).

The docs name `AskUserQuestion` only as an example of a tool to put in `disallowed-tools`. The
changelog entry of 2.1.69 calls it an interactive tool. No source gives a list of other interactive
tools. So the rule checks `EndConversation` and `AskUserQuestion` only.

The rule reads a string or a list. It splits a string at spaces and commas outside parentheses.
It reads the tool name of a permission rule, such as `AskUserQuestion` in `AskUserQuestion(x)`.
The report is on the value of the field.

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
allowed-tools: Read AskUserQuestion
disallowed-tools: EndConversation
---
```

Pass:

```markdown
---
allowed-tools: Read
disallowed-tools: AskUserQuestion
---
```

## Options

None.

## Sources

[^reference]: [Extend Claude with skills: Frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)
[^preapprove]: [Extend Claude with skills: Pre-approve tools for a skill](https://code.claude.com/docs/en/skills#pre-approve-tools-for-a-skill)
[^endconversation]: [Tools reference: EndConversation tool behavior](https://code.claude.com/docs/en/tools-reference#endconversation-tool-behavior)
