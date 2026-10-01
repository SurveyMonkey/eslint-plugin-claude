---
type: Reference
description: The ESLint rule claude/skill-plugin-vars-outside-plugin, which reports CLAUDE_PLUGIN_ROOT and CLAUDE_PLUGIN_DATA in the body or allowed-tools of a skill or command file outside a plugin, where they stay literal text.
owner: brianespinosa
created: 2026-09-30
related_issues: [8]
stale_after: 2027-03-30
generated:
  by: claude-code
  at: 2026-09-30T00:00:00Z
---

# `skill-plugin-vars-outside-plugin`

Use plugin variables in plugin skills only.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/SKILL.md`, `**/commands/**/*.md` |

## Rule details

Claude Code replaces `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` in plugin skills
only.[^substitutions] It replaces them in the skill body and in the `allowed-tools` field. In
any other skill, the two variables stay literal text. A script path that uses one does not
resolve, and no error shows.

The rule reports each use of the two variables in a skill or command file that is not in a plugin.
It reads the body and the `allowed-tools` value. The report is on the variable. The rule also
reports inside fenced code. The docs say that Claude Code replaces the variables in the markdown
content of a plugin skill, and they do not exempt fenced code.

The two variables are the only ones that the rule checks. `${CLAUDE_SKILL_DIR}`,
`${CLAUDE_PROJECT_DIR}`, `${CLAUDE_SESSION_ID}` and `${CLAUDE_EFFORT}` work in every skill.

The rule ignores a file whose frontmatter does not parse.

The rule checks the files that the other skill rules check:

- `.claude/skills/<name>/SKILL.md`
- `<plugin>/skills/<name>/SKILL.md`
- `<plugin>/SKILL.md`
- `.claude/commands/**/*.md`
- `<plugin>/commands/**/*.md`

A file in a plugin is not a report. A file elsewhere, such as `docs/SKILL.md`, is not a report
either. A plugin root is a directory with `.claude-plugin/plugin.json`.

Fail, in `.claude/skills/render/SKILL.md`:

```markdown
---
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/scripts/render.sh *)
---

Run `${CLAUDE_PLUGIN_ROOT}/scripts/render.sh`.
```

Pass, in `.claude/skills/render/SKILL.md`:

```markdown
---
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/render.sh *)
---

Run `${CLAUDE_SKILL_DIR}/scripts/render.sh`.
```

## Options

None.

## Sources

[^substitutions]: [Extend Claude with skills: Available string substitutions](https://code.claude.com/docs/en/skills#available-string-substitutions)
