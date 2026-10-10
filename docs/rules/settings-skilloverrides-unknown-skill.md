---
type: Reference
description: The ESLint rule claude/settings-skilloverrides-unknown-skill, which reports a skillOverrides key in a project or local settings file that matches no bundled skill and no skill or command under .claude/. It is off in recommended.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-skilloverrides-unknown-skill`

Key `skillOverrides` by the name of a skill that the repository or Claude Code has.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | consistency | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

The rule is `off` in `recommended`. It is a heuristic, because user skills are not in the
repository. `strict` turns it on at `warn`.

## Rule details

The setting `skillOverrides` maps the name of a skill to a visibility. Claude Code matches each key
with the name of a skill in the session. A key with no skill behind it has no effect.[^key]

The rule accepts a key that is one of these:

- A bundled skill. The list is in `src/data/skill-fields.ts`. It follows the rows that the commands
  reference marks as a skill.[^commands]
- An alias of a bundled skill, such as `review`. In a project file, Claude Code does not apply an
  alias. `settings-skilloverrides-key` reports that, so this rule stays silent.[^override]
- The name of a skill folder in `.claude/skills/`. The folder name counts, and so does the `name`
  field of its `SKILL.md`.[^naming]
- The file name of a command file in `.claude/commands/`, without `.md`.[^naming]
- A name in the option `allow`.
- A name with a colon. That is the form of a plugin skill, of a nested skill and of a command in a
  subfolder. Plugin skills are not affected by `skillOverrides`. The rule does not look up such a
  name.

The docs do not say if Claude Code compares the names with case, so the rule does not.

The report is on the key.

### Where the rule looks

Claude Code loads project skills from the `.claude/skills/` folder of the directory where it starts,
and from every parent directory up to the repository root.[^discovery] The rule reads the
`.claude/skills/` and `.claude/commands/` folders of the project that holds the settings file, and
of each directory above it up to the repository root. It reads no file out of the repository (ADR
001, Decision 14).

A skill in a folder below the project does not load at the start. The rule does not read it. A user
skill (`~/.claude/skills/`), a skill from a folder added with `--add-dir`, and a skill from the
account are not in the repository. Name such a skill in the option `allow`.

The rule makes no report when it cannot see a skill. These cases give no report. A link leads out of
the repository. The project is a link out of the repository. A link in place of `.claude`, a skills
folder or a skill folder has no target. The rule cannot read a folder. The rule cannot read a
`SKILL.md`.

### Options

| Option | Type | Default | Meaning |
|--------|------|---------|---------|
| `allow` | array of strings | `[]` | Skill names to accept, such as a user skill |

### What the rule does not check

- A managed file. A managed file applies to every project on a machine. The skills that it names
  are not in the repository that holds it.
- A value of a key. `settings-schema` reports a value that is not one of the four words.
- A key with a `null` value, which removes the entry.

When a file has two keys of one name, the rule reads the last, as `JSON.parse` does.

Fail:

```json
{
  "skillOverrides": {
    "legacy-context": "name-only"
  }
}
```

Pass, with `.claude/skills/legacy-context/SKILL.md`:

```json
{
  "skillOverrides": {
    "legacy-context": "name-only"
  }
}
```

## Sources

[^key]: [All settings: skillOverrides](https://code.claude.com/docs/en/settings-reference#skilloverrides)
[^override]: [Extend Claude with skills: Override skill visibility from settings](https://code.claude.com/docs/en/skills#override-skill-visibility-from-settings)
[^naming]: [Extend Claude with skills: How a skill gets its command name](https://code.claude.com/docs/en/skills#how-a-skill-gets-its-command-name)
[^discovery]: [Extend Claude with skills: Load skills in monorepos and subdirectories](https://code.claude.com/docs/en/skills#discovery-from-parent-and-nested-directories)
[^commands]: [Commands: All commands](https://code.claude.com/docs/en/commands#all-commands)
