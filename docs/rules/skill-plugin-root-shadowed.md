---
type: Reference
description: The ESLint rule claude/skill-plugin-root-shadowed, which reports a SKILL.md at the root of a plugin that has a skills/ directory or a skills key in plugin.json, because Claude Code does not load that file.
owner: brianespinosa
created: 2026-09-30
related_issues: [8]
stale_after: 2027-03-30
generated:
  by: claude-code
  at: 2026-09-30T00:00:00Z
---

# `skill-plugin-root-shadowed`

Do not put a `SKILL.md` at the root of a plugin that has other skills.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/SKILL.md` |

## Rule details

A plugin can hold one skill at its root. Claude Code loads a `SKILL.md` at the plugin root only
when the plugin has no `skills/` directory and `plugin.json` has no `skills` key.[^skills] In any
other case it does not load the root file, and it shows no error.

The rule reads a `SKILL.md` that sits directly in a plugin root. A plugin root is a directory with
`.claude-plugin/plugin.json`. The rule reports on line 1 in these cases:

- The plugin root has a `skills/` directory. The report is `directory`.
- `plugin.json` has a `skills` key, with any value. The report is `manifest`.

A file can get both reports. The rule does not read the frontmatter of the file.

The rule is silent in these cases:

- A skill in `skills/<name>/SKILL.md`. It is not the root skill.
- A `SKILL.md` in a directory that has no manifest.
- A manifest that does not parse, or that is not an object. The rule reads no key from it.

The rule cannot see a `skills/` directory that the tool adds at install time. It reads the
checkout only.

Fail, a plugin with `SKILL.md` and `skills/review/SKILL.md`:

```text
my-plugin/
├── .claude-plugin/plugin.json
├── SKILL.md
└── skills/review/SKILL.md
```

Pass, the same plugin without `skills/`:

```text
my-plugin/
├── .claude-plugin/plugin.json
└── SKILL.md
```

## Options

None.

## Sources

[^skills]: [Add components to a plugin: Skills](https://code.claude.com/docs/en/plugins/components#skills)
