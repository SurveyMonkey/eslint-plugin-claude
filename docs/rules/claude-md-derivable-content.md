---
type: Reference
description: The ESLint rule claude/claude-md-derivable-content, off in recommended and warn in strict, which reports a directory tree, a list of dependencies or a file-by-file list in a CLAUDE.md or CLAUDE.local.md file, because Claude can work out this content from the code and it costs context in every session.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# claude/claude-md-derivable-content

📝 Leave out of CLAUDE.md what Claude can work out from the code.

⚠️ This rule _warns_ in the 🔒 `strict` config.

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| practice | `**/CLAUDE.md`, `**/CLAUDE.local.md` |

The rule is `off` in `recommended`.

## Rule details

The docs say that `/doctor` cuts content that Claude can derive from the code base, such as
directory layouts, dependency lists and architecture overviews.[^trim] The best practices page tells
you to keep only what Claude "couldn't work out from the code itself".[^exclude]

The rule reports three shapes. It reads the syntax tree, so it reports the whole block or list:

- **A directory tree.** A code block with at least three lines that start a branch. A branch mark is
  `├─` or `└─`, or the plain forms `|--`, `+--`, `\--` and a backtick with `--`. A plain mark
  starts the line, after any indent or tree bars, and a name follows it. The Windows `tree` forms
  `+---` and `\---` count. So the border `+----+` of a table is not a branch.
- **A list of dependencies.** A code block with a double-quoted `dependencies`,
  `devDependencies`, `peerDependencies` or `optionalDependencies` key (JSON), or a TOML table of dependencies, or at least
  three lines that pin a version, as in `flask==3.0.0`.
- **A file-by-file list.** A list of at least three items that all start with a code span with a
  path, then a colon, a dash and a space, or the word `is`, `holds` or `contains`. A path has a
  slash or an extension. The list must be only such items.

The rule makes no report in these cases:

- A tree has fewer than three branches, or is not in a code block.
- A block has one pinned line, or the word `dependencies` is in prose.
- A list mixes file items with other items, or has fewer than three items.
- The text is in an HTML comment.
- The file is not a `CLAUDE.md`, a `.claude/CLAUDE.md` or a `CLAUDE.local.md`. The rule does not
  read a rule file.

The rule is a heuristic. A tree can show a fact that the code does not, such as a folder that a tool
generates. Then the block is worth its cost.

Fail:

````markdown
```text
src/
├── index.ts
├── rules/
└── data/
```
````

Pass:

```markdown
The rules are in `src/rules/`. Each rule has a test in `tests/rules/`.
```

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/claude-md-derivable-content': 'warn'
```

## Sources

[^trim]: [How Claude remembers your project: My CLAUDE.md is too large](https://code.claude.com/docs/en/memory#my-claude-md-is-too-large)
[^exclude]: [Best practices for Claude Code: Keep CLAUDE.md short](https://code.claude.com/docs/en/best-practices#keep-claude-md-short)
