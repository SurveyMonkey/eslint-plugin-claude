---
type: Reference
description: The ESLint rule claude/skill-no-bom, which reports a SKILL.md or command file that starts with a UTF-8 byte order mark, because Claude Code before v2.1.239 ignores such a file, with its option, examples and sources.
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

## Rule details

Claude Code 2.1.239 fixed agent, skill and command files that start with a UTF-8 byte order mark
(BOM). Before that version, it silently ignored such a file.[^changelog] The file does not load,
and no error shows. The mark is the three bytes `EF BB BF`.

The live docs page of the changelog is too large to keep as a snapshot in this repository. So the
source map cites the skills page. It says that Claude Code reads the frontmatter only when the
opening `---` is the first line of the file.[^reference] Read the 2.1.239 entry in the
[changelog file](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md).

The rule reports a skill or command file that starts with the mark.

ESLint removes the mark before a rule sees the text. So the rule reads the first three bytes of
the file on disk. The rule makes no report in these cases:

- The file is not on disk, as in a lint of text from an editor.
- The file is a link to a file outside the repository, or the link is dangling or loops.
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
'claude/skill-no-bom': ['warn', { minVersion: '2.1.239' }]
```

With no `minVersion`, the plugin cannot know the version that reads the file. So the rule reports.
When `minVersion` is `2.1.239` or later, the rule makes no report. The value has three numbers,
such as `2.1.239`. The `recommended` and `strict` configs set no option.

## Sources

[^reference]: [Extend Claude with skills: Frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)
[^changelog]: [Claude Code changelog: 2.1.239](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)
