---
type: Reference
description: The ESLint rule claude/skill-reference-exists, which reports a relative Markdown link in a SKILL.md, or a backticked CLAUDE_SKILL_DIR path, that names a file which is not in the skill folder.
owner: brianespinosa
created: 2026-09-30
related_issues: [8]
stale_after: 2027-03-30
generated:
  by: claude-code
  at: 2026-09-30T00:00:00Z
---

# `skill-reference-exists`

Link only to files that exist in the skill folder.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/SKILL.md` |

## Rule details

A skill can have supporting files in its folder. `SKILL.md` names them, so that Claude knows
when to read each one.[^files] A name for a file that is not there sends Claude to a dead end.

The rule reports a reference that names a path that does not exist in the skill folder. A path
to a directory that exists passes. The folder is the directory of the `SKILL.md`. For a plugin-root `SKILL.md`, it is the
plugin root. The report is on the link or on the code span.

These references count as paths:

- The target of a Markdown link, an image, or a link reference definition, if it is relative.
  The rule removes a `#fragment` and a `?query`, and decodes `%20` and the like.
- A code span that starts with `${CLAUDE_SKILL_DIR}/`. This is the form that the docs give for
  a path in a skill.[^dir] The rule reads the first word of the span, up to a space. The rule
  tests the part after the variable. A link target may use the same prefix.

The rule is silent in these cases:

- The target is a URL, such as `https://…` or `mailto:…`, or starts with `//`.
- The target is only an anchor, such as `#usage`, or is empty.
- The target is absolute (`/…`), starts with `~`, or has a drive letter.
- The target holds `$`, `*`, `{`, `}` or `|`, so it can be a placeholder or a pattern.
- The target leaves the skill folder (`../…`). The rule checks files in the folder only.
- The reference is in fenced code, or in the frontmatter.
- A code span has a path without the `${CLAUDE_SKILL_DIR}/` prefix, such as `src/index.ts`,
  `./gradlew` or `scripts/run.py`. Such a span is often a file of the project or a command,
  and its base directory is not known. A backticked word is not a path.

The rule does not read the frontmatter. It checks the body of a file with frontmatter that does
not parse. A command file is not in scope. A `SKILL.md` that is not in a skill location, such as
`docs/SKILL.md`, is not in scope.

The rule asks the file system, so a name with a different letter case can pass on a file system
that ignores case. It does not check what is in a directory that a link names.

Fail:

```markdown
For complete API details, see [reference.md](reference.md).
```

The folder has no `reference.md`.

Pass:

```markdown
For complete API details, see [reference.md](reference.md).
For the script, run `${CLAUDE_SKILL_DIR}/scripts/helper.py`.
```

The folder has `reference.md` and `scripts/helper.py`.

## Options

None.

## Sources

[^files]: [Extend Claude with skills: Add supporting files](https://code.claude.com/docs/en/skills#add-supporting-files)
[^dir]: [Extend Claude with skills: Available string substitutions](https://code.claude.com/docs/en/skills#available-string-substitutions)
