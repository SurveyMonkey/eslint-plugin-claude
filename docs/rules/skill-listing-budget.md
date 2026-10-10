---
type: Reference
description: The ESLint rule claude/skill-listing-budget, which reports each skill and command file of a .claude directory or plugin whose names and descriptions together are over the character budget of the skill listing, with its options, examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [50]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `skill-listing-budget`

Keep the skill and command descriptions of one scope within the listing budget.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | limit | `**/SKILL.md`, `**/commands/**/*.md` |

The rule is `off` in `recommended`. The rule is a heuristic, and it reads more than one file.

## Rule details

Claude Code lists the name and description of each skill, so that Claude knows what is
available. The listing has a character budget. When the listing is over the budget, Claude Code
drops descriptions. It drops those of the skills that you invoke least first.[^cut] The budget is
1% of the context window, with a fallback of 8,000 characters.[^env] The rule uses 8,000
characters. The real budget depends on the model. Two settings, `skillListingBudgetFraction` and
`SLASH_COMMAND_TOOL_CHAR_BUDGET`, move it.[^cut]

The rule sums the entries of one scope. A scope is a `.claude/` directory, or a plugin root. Each
skill or command file is one entry. Its size is the length of its name, plus the length of
`description` and `when_to_use` together. Claude Code caps the text of each entry at 1,536 characters, whatever
the budget.[^cut] So the rule counts at most 1,536 characters of text for each entry.

- A skill takes its name from `name`. It uses the folder name when `name` is not a non-empty
  string. The name of a command file is its path below `commands/`, with each `/` as `:`. The
  rule ignores the plugin prefix.
- A file that has `disable-model-invocation: true` is not in the listing, so it adds nothing.[^invoke]
  The rule counts only the Boolean `true` as that value. A file with the string `"true"` is in
  the count.
- A file with no frontmatter, or with a block that does not parse, adds its name.
- A field that is not a string adds nothing.
- A skill with no `description` is listed with the first line of its body. The rule counts none
  of it, so the sum can be too low.

The rule reports at line 1 of each skill and command file of a scope that is over the budget. The
message gives the total of the scope and the share of that file. It reads the file that it lints
from the text that ESLint gives. It reads the other files from the disk.

The rule reads the files of the repository only. The repository is the first directory at or
above the scope that has a `.git` entry. Without one, it is the scope. The rule makes no report
that rests on a file that it cannot read. It makes no report in these cases:

- It cannot list `commands/`.
- A link in `commands/` leads out of the repository.
- It cannot read a skill or command file.
- The manifest of the plugin is unreadable, or has a `skills` key.

The rule does not follow a skill folder link that leads out of the repository. A manifest with a
`commands` key replaces `commands/`, so the rule skips that folder.

The rule does not count the skills of other scopes, of the user, or of installed plugins. It
cannot see them. A nested `.claude/` directory is a scope of its own. The rule is silent for a
plugin-root `SKILL.md`, which has no folder name.

Fail, with `max: 150`: two skills with entries of 100 characters each. Pass: the same skills with
`max: 200`.

## Options

| Option | Default | Use |
|--------|---------|-----|
| `max` | `8000` | The most characters that the entries of one scope can have. Optional. |
| `listingMax` | `1536` | The cut of the text of one entry. Optional. |

```js
'claude/skill-listing-budget': ['warn', { max: 16000, listingMax: 1024 }]
```

The defaults are the numbers from the docs. The schema sets no maximum, because the settings above
move both numbers. The `recommended` and `strict` configs set no option.

When `max` is 8000, the message names the documented fallback budget. At another value, the message
says "The configured limit is 16000 characters". It does not say that Claude Code drops
descriptions at that value.

## Sources

[^cut]: [Extend Claude with skills: Skill descriptions are cut short](https://code.claude.com/docs/en/skills#skill-descriptions-are-cut-short)
[^env]: [Environment variables: Variables](https://code.claude.com/docs/en/env-vars#variables)
[^invoke]: [Extend Claude with skills: Control who invokes a skill](https://code.claude.com/docs/en/skills#control-who-invokes-a-skill)
