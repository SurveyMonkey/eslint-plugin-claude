---
type: Reference
description: The ESLint rule claude/skill-no-bom, which reports a SKILL.md or command file that starts with a byte order mark, because Claude Code before v2.1.239 ignores such a file, with its option, examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [50]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `skill-no-bom`

Save a skill or command file with no byte order mark.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/SKILL.md`, `**/commands/**/*.md` |

The rule makes no report until the option `minVersion` is set.

## Rule details

Claude Code 2.1.239 fixed agent, skill and command files that start with a UTF-8 BOM
(byte order mark). Before that version, it silently ignored such a file.[^changelog] The file does not load,
and no error shows. The mark is the three bytes `EF BB BF`.

The live docs page of the changelog is too large to keep as a snapshot in this repository. So the
source map cites the skills page. It says that Claude Code reads the frontmatter only when the
`---` that starts the block is the first line of the file.[^reference] Read the 2.1.239 entry in the
[changelog file](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md).

The rule reports a skill or command file that starts with the mark.

ESLint removes the mark before a rule sees the text. So the rule reads the first three bytes of
the file on disk. It does not read the text in the editor, so the text can differ from the saved
file. The rule makes no report in these cases:

- The file is not on disk, as in a lint of text with no saved file.
- The file is a link to a file outside the repository, or the link is broken or loops back to itself.
- The rule has no read access to the file.

The rule checks these files:

- `.claude/skills/<name>/SKILL.md`
- `<plugin>/skills/<name>/SKILL.md`
- `<plugin>/SKILL.md`
- `.claude/commands/**/*.md`
- `<plugin>/commands/**/*.md`

A file elsewhere, such as `docs/SKILL.md`, is not a report. A plugin root is a directory with
`.claude-plugin/plugin.json`.

To remove the mark, save the file again as "UTF-8" and not as "UTF-8 with BOM".

Fail (the file starts with the three bytes of the mark, here written as `[BOM]`):

```markdown
[BOM]---
name: deploy
description: Deploys the service.
---
```

Pass:

```markdown
---
name: deploy
description: Deploys the service.
---
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `minVersion` | unset | The oldest Claude Code version that the repository supports, such as `2.1.239`. Optional. |

```js
'claude/skill-no-bom': ['warn', { minVersion: '2.1.200' }]
```

With no `minVersion`, the rule is inactive and makes no report. The `recommended` and `strict`
configs set no option, so a team turns the rule on when it sets its floor. The example turns the
rule on for a floor older than 2.1.239. When `minVersion` is
`2.1.239` or later, the rule makes no report. The value has three numbers,
such as `2.1.239`.

## Sources

[^reference]: [Extend Claude with skills: Frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)
[^changelog]: [Claude Code changelog: 2.1.239](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)
