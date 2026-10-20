---
type: Reference
description: The ESLint rule claude/skill-name-characters, which reports a skill folder, a command file or folder, or a frontmatter name that holds a character Claude Code refuses, such as a zero-width space, a control character, an extra blank or an angle bracket.
owner: brianespinosa
created: 2026-10-14
related_issues: [304, 330]
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

Claude Code refuses a command name or a frontmatter `name` that holds characters such as
these:[^characters][^refused]

- A zero-width space (U+200B), or a control character (`Cc`). The rule also counts U+FEFF, because
  its Unicode name is ZERO WIDTH NO-BREAK SPACE.
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
- The frontmatter `name` of a skill. The skill loads. But the `/` menu does not show the `name`
  value, and the value does not invoke the skill. Edit the `name` field.

The message gives the first character that Claude Code refuses, by its code point. The name in
the message shows each refused character as `<U+XXXX>`. So a direction control or a zero-width
space cannot hide in the text.

The rule does not report a folder in the `skills/` directory of a plugin. Claude Code changes the
characters to hyphens in the command name of such a skill, and the skill loads.[^characters] It
still reports the `name` field of a plugin skill, and the file or folder name of a plugin command.

The docs give examples, not a full list. The rule reports only the classes above. So it does not
report a zero-width joiner, which is also a part of many emoji. The rule does not read the `name`
field of a command file. A command gets its name from its path, and the docs give the `name`
effect for a skill only.

Claude Code also refuses a name over 256 characters.[^refused] The rule reports this length
fault, with no option: the limit is fixed. The docs do not say how Claude Code counts
characters. The rule counts code points.

- A frontmatter `name` of a skill is one name.
- The name of a command is its folders and its file name, joined with `:`. The docs do not say
  if the limit applies to this joined name or to each part. The rule uses the joined name, which
  is the longer count. A part over 256 characters cannot be on disk, so only the joined name
  can be over the limit. The rule does not add the plugin name to a plugin command name.
- A skill folder name is not checked for length. A folder name of 256 bytes or more cannot exist.
- The rule gives one report for each name over the limit. A name that also holds a refused
  character gets both reports.

The rule does not read the plugin manifest. So it does not check a skill or command at a
manifest `skills` or `commands` path. When a manifest `commands` key replaces `commands/`,
Claude Code does not load the files there. The rule still reports them.

The rule checks the files that the other skill rules check:

- `.claude/skills/<name>/SKILL.md`
- `<plugin>/skills/<name>/SKILL.md`, for the `name` field only
- `<plugin>/SKILL.md`, for the `name` field only
- `.claude/commands/**/*.md`
- `<plugin>/commands/**/*.md`

Fail: `.claude/skills/deploy<prod>/SKILL.md`, `.claude/commands/run  tests.md`, a `SKILL.md`
with `name: " deploy"`, and a `SKILL.md` with a `name` of 257 characters.

Pass: a `SKILL.md` with a `name` of 256 characters, `.claude/skills/deploy app/SKILL.md`, and
`plugins/ops/skills/deploy<prod>/SKILL.md` with a manifest in `plugins/ops/.claude-plugin/`.

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/skill-name-characters': 'error'
```

## Sources

[^characters]: [Extend Claude with skills: Characters a skill name can't hold](https://code.claude.com/docs/en/skills#characters-a-skill-name-cant-hold)
[^refused]: [Error reference: Skill or command name refused](https://code.claude.com/docs/en/errors#skill-or-command-name-refused)
