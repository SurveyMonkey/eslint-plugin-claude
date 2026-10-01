---
type: Reference
description: The ESLint rule claude/skill-frontmatter-schema, which reports a frontmatter key that Claude Code does not know, a near miss of a known key, a wrong type or value, and a name or paths field in a command file.
owner: brianespinosa
created: 2026-09-30
related_issues: [8]
stale_after: 2027-03-30
generated:
  by: claude-code
  at: 2026-09-30T00:00:00Z
---

# `skill-frontmatter-schema`

Use the frontmatter fields of a skill, with the right types and values.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/SKILL.md`, `**/commands/**/*.md` |

## Rule details

Claude Code ignores a field that it does not know. It shows no error. A field name must match the
Frontmatter reference exactly, hyphens included.[^reference] A misspelled key, such as
`allowed_tools`, silently turns off the setting.

The rule uses the Frontmatter reference of the Claude Code docs as of Claude Code 2.1.286
(2026-09-30). The field list is in `src/data/skill-fields.ts`. The rule reports these faults, on
the narrowest part of the key or value:

- **Unknown key.** A key that is not in the table.
- **Near miss.** A key that has the letters of a known key with a different case, hyphens or
  underscores, such as `allowed_tools` or `when-to-use`. The report has a suggestion that renames
  the key. The suggestion is not an autofix. A rename turns on a setting that did nothing before.
- **Command file.** A command file takes the skill fields except `name` and `paths`.[^command][^directory][^plugin]
  The rule reports each of these two keys in a command file.
- **Type.** `name`, `description` and `argument-hint` are strings. `arguments`, `allowed-tools`,
  `disallowed-tools` and `paths` are a string or a list. `metadata` is a map.[^reference]
  `compatibility` is a string of 500 characters or fewer. `model` is a string that is not empty.
- **Value.** `effort` is `low`, `medium`, `high`, `xhigh` or `max`. `context` is `fork`. `shell` is
  `bash` or `powershell`.[^reference]

A key with no value is the same as an absent key, and the rule ignores it. The rule does not
check Boolean fields: Claude Code reads `yes`, `no`, `on`, `off`, `1` and `0` as Booleans.[^reference]

The rule checks that `model` is a string that is not empty, and no more. The docs say that `model`
takes the values of `/model`. On a provider other than the Anthropic API, or behind a gateway,
Claude Code refuses an empty model string only.[^model] A check for an alias or a `claude-` prefix
would report a valid value.

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
name: deploy
allowed_tools: Bash(git push *)
effort: extreme
---
```

Pass:

```markdown
---
name: deploy
allowed-tools: Bash(git push *)
effort: high
---
```

## Options

None.

## Sources

[^reference]: [Extend Claude with skills: Frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)
[^command]: [Extend Claude with skills: Choose where skills load](https://code.claude.com/docs/en/skills#where-skills-live)
[^directory]: [Explore the .claude directory: Frontmatter fields by file](https://code.claude.com/docs/en/claude-directory#frontmatter-fields-by-file)
[^plugin]: [Add components to a plugin: Commands](https://code.claude.com/docs/en/plugins/components#commands)
[^model]: [Error reference: Model is not a recognized model id](https://code.claude.com/docs/en/errors#model-is-not-a-recognized-model-id)
