---
type: Reference
description: The ESLint rule claude/command-legacy-format, which reports each Markdown file in a .claude/commands/ directory or in the commands/ directory of a plugin as the legacy form of a skill.
owner: brianespinosa
created: 2026-09-29
related_issues: [6]
stale_after: 2027-03-29
generated:
  by: claude-code
  at: 2026-09-29T00:00:00Z
---

# `command-legacy-format`

Use a skill, not the legacy command format.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | deprecated | `**/commands/**/*.md` |

## Rule details

Commands still work, but the docs call them the older format of a skill.[^first][^glossary] A
skill at `skills/<name>/SKILL.md` does the same job. It also holds supporting files, and the
model can start it on its own.[^merged][^components]

The glob is broad. The rule then reports a file only when its `commands/` directory is one that
Claude Code reads:

- `.claude/commands/`, and any directory below it;
- a `commands/` directory at the root of a plugin, next to `.claude-plugin/plugin.json`.

Any other `commands/` directory, for example `docs/commands/`, is not a report. A plugin with no
`.claude-plugin/plugin.json` is not a report either, because the rule finds a plugin root by
its manifest. When `plugin.json` sets `commands`, Claude Code does not read the `commands/`
directory.[^manifest] The rule still reports it.

Fail: `.claude/commands/deploy.md`, `plugins/ops/commands/deploy.md`.

Pass: `.claude/skills/deploy/SKILL.md`, `plugins/ops/skills/deploy/SKILL.md`,
`docs/commands/deploy.md`.

## Options

None.

## Sources

[^first]: [Extend Claude with skills: Create your first skill](https://code.claude.com/docs/en/skills#create-your-first-skill)
[^glossary]: [Glossary: Deprecated and renamed terms](https://code.claude.com/docs/en/glossary#deprecated-and-renamed-terms)
[^merged]: [Extend Claude with skills](https://code.claude.com/docs/en/skills)
[^components]: [Add components to a plugin: Commands](https://code.claude.com/docs/en/plugins/components#commands)
[^manifest]: [Plugin manifest reference: How each key combines with its default location](https://code.claude.com/docs/en/plugins/manifest-reference#how-each-key-combines-with-its-default-location)
