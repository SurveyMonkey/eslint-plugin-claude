---
type: Reference
description: The ESLint rule claude/skill-name-characters, which reports a skill folder, a command file or folder, or a frontmatter name that holds a character Claude Code refuses, such as a zero-width space, a control character, an extra blank or an angle bracket.
owner: brianespinosa
created: 2026-10-14
related_issues: [304]
stale_after: 2027-04-14
generated:
  by: claude-code
  at: 2026-10-14T00:00:00Z
---

# claude/skill-name-characters

📝 Do not put a character that Claude Code refuses in a skill or command name.

💼 This rule is enabled in the following configs: ✅ `recommended`, 🔒 `strict`.

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| load | `**/SKILL.md`, `**/commands/**/*.md` |

## Rule details

Claude Code refuses a command name or a frontmatter `name` that holds one of these
characters:[^characters][^refused]

- A zero-width space (U+200B or U+FEFF), or a control character (`Cc`).
- A private-use character (`Co`), such as a glyph from an icon font, or an unassigned character
  (`Cn`).
- A character that changes the text direction (`Bidi_Control`).
- A blank that is not a plain space, such as a no-break space. A plain space is also a fault at
  the start or the end of the name, or next to another space.
- `<` or `>`.

The rule reports these cases:

- A skill folder in `.claude/skills/`. Claude Code does not load the skill. Rename the folder.
- A command file, or a folder below `commands/`. Claude Code does not load the command. Rename
  the file or the folder. The name of a file is its name without `.md`.
- The frontmatter `name` of a skill. The skill loads, but the `/` menu does not show the `name`
  value, and the value does not invoke the skill. Edit the `name` field.

The message gives the first character that Claude Code refuses, by its code point.

The rule does not report a folder in the `skills/` directory of a plugin. Claude Code changes the
characters to hyphens in the command name of such a skill, and the skill loads.[^characters] It
still reports the `name` field of a plugin skill, and the file or folder name of a plugin command.

The docs name the zero-width space only. So the rule does not report a zero-width joiner, which
is also a part of many emoji. The rule does not read the `name` field of a command file, because
a command file takes no `name`. [`skill-frontmatter-schema`](skill-frontmatter-schema.md) reports
it.

The rule checks the files that the other skill rules check:

- `.claude/skills/<name>/SKILL.md`
- `<plugin>/skills/<name>/SKILL.md`, for the `name` field only
- `<plugin>/SKILL.md`, for the `name` field only
- `.claude/commands/**/*.md`
- `<plugin>/commands/**/*.md`

Fail: `.claude/skills/deploy<prod>/SKILL.md`, `.claude/commands/run  tests.md`, a `SKILL.md`
with `name: " deploy"`.

Pass: `.claude/skills/deploy app/SKILL.md`, `plugins/ops/skills/deploy<prod>/SKILL.md`.

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/skill-name-characters': 'error'
```

## Sources

[^characters]: [Extend Claude with skills: Characters a skill name can't hold](https://code.claude.com/docs/en/skills#characters-a-skill-name-cant-hold)
[^refused]: [Error reference: Skill or command name refused](https://code.claude.com/docs/en/errors#skill-or-command-name-refused)
