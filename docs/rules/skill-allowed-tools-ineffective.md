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
- `AskUserQuestion` in `allowed-tools`. Claude Code does not auto-allow an interactive tool that
  a skill lists. Since Claude Code 2.1.69, the permission prompt shows. Before that version, the
  entry skipped the prompt and the tool ran with empty answers.[^reference][^preapprove]
  The [changelog](https://code.claude.com/docs/en/changelog) records the fix.

The docs name `AskUserQuestion` as the one example of an interactive tool. They give no list of
other interactive tools. So the rule checks `EndConversation` and `AskUserQuestion` only.

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
