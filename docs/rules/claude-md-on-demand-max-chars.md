---
type: Reference
description: The ESLint rule claude/claude-md-on-demand-max-chars, which reports a CLAUDE.md, CLAUDE.local.md or rule file that loads on demand, or a file that such a CLAUDE.md imports, of more than 40,000 characters, the size over which Claude gets only the start of the file, with a max option.
owner: brianespinosa
created: 2026-11-09
related_issues: [623]
stale_after: 2027-05-09
generated:
  by: claude-code
  at: 2026-11-09T00:00:00Z
---

# claude/claude-md-on-demand-max-chars

📝 Keep an instruction file that loads on demand at or under 40,000 characters.

⚠️ This rule _warns_ in the following configs: ✅ `recommended`, 🔒 `strict`.

<!-- end auto-generated rule header -->

| Category | Files                                                            |
| -------- | ---------------------------------------------------------------- |
| limit    | `**/CLAUDE.md`, `**/CLAUDE.local.md`, `**/.claude/rules/**/*.md` |

## Rule details

Claude Code applies a per-file size limit to an instruction file that loads on demand. When the
file is over the limit, Claude gets only the start of it. The later instructions are not in its
context until Claude reads the rest with the Read tool.[^end] Claude Code v2.1.309 or later
applies the limit.[^end]

The limit applies to these files, which load on demand:[^end]

- A `CLAUDE.md` or `CLAUDE.local.md` in a subfolder of the start folder, and the files that it
  imports with `@path`, to the depth of four hops.[^import] The rule also reads a
  `.claude/CLAUDE.md` in a subfolder. The docs name three `CLAUDE.md` files for each
  subfolder.[^agents]
- A rule file in the `.claude/rules/` of a subfolder, with or without `paths`.
- A rule file with `paths` in the project `.claude/rules/`.[^paths] A `paths` value that is
  empty, or YAML that does not parse, sets no scope.

The rule stays silent on the files of the start folder that load at launch: its `CLAUDE.md`,
`.claude/CLAUDE.md` and `CLAUDE.local.md`, the files that they import, and each project rule file
with no `paths`.

The rule counts characters as `wc -m` does in a UTF-8 locale: one for each code point.[^end] So
`é` counts one, not two bytes, and an emoji counts one, not two UTF-16 units. A carriage return
counts. The comparison is exact: a file of 40,000 characters passes, and a file of 40,001
reports. The report is at the start of the file. For an imported file, the report is at the
import of the linted file that leads to it, and names the file.

The start folder is where you start Claude Code. A lint run cannot know it, so the rule takes the
git top above the file as the start. Without a `.git`, the start is the folder that holds the
file, or that holds its `.claude/` folder. So, with no `.git`, only a project rule file with
`paths` can report. A session that starts in a subfolder of the repository has another start,
and the rule can then report a file that loads at launch.

Not checked:

- `~/.claude/rules/`, which is out of the repository (ADR 001, Decision 14).
- The imports of a rule file. The docs name the imports of a `CLAUDE.md` file only.
- An imported file that is itself a `CLAUDE.md`, `CLAUDE.local.md` or rule file. The rule lints
  it on its own, or it loads at launch.
- An imported file that the rule cannot read, or that is out of the repository.
- A subfolder `CLAUDE.md` that the root `CLAUDE.md` imports, which then loads at launch.
- A byte order mark at the start of the linted file. ESLint removes it before the rule runs, so
  the rule counts one character fewer than `wc -m`.

Fail, for a file at `packages/api/CLAUDE.md` of more than 40,000 characters:

```markdown
# API package

<!-- 40,001 characters of instructions -->
```

Pass: the same text in the root `CLAUDE.md`, or in `.claude/rules/api.md` with no `paths`.

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/claude-md-on-demand-max-chars': 'warn'
```

## Options

<!-- begin auto-generated rule options list -->

| Name  | Description                      | Type    | Default |
| :---- | :------------------------------- | :------ | :------ |
| `max` | The most characters in the file. | Integer | `40000` |

<!-- end auto-generated rule options list -->

```js
'claude/claude-md-on-demand-max-chars': ['warn', { max: 150000 }]
```

The default is 40,000, the limit for a 200K context window. A 1M context window has a limit of
200,000 characters on Claude Opus 4.6 and Claude Sonnet 4.6, and 150,000 on later models.[^end]
The model of a session sets its context window, so the schema sets no maximum. Set `max` to the
limit of the window that your team uses. The `recommended` and `strict` configs set no option.

At the default, the message says that Claude gets only the start of a file of more than 40,000
characters. At another value, the message gives the configured limit and does not say what the
docs allow.

## Sources

[^end]: [How Claude remembers your project: Claude ignores the end of my subdirectory CLAUDE.md](https://code.claude.com/docs/en/memory#claude-ignores-the-end-of-my-subdirectory-claude-md)
[^import]: [How Claude remembers your project: Import additional files](https://code.claude.com/docs/en/memory#import-additional-files)
[^paths]: [How Claude remembers your project: Path-specific rules](https://code.claude.com/docs/en/memory#path-specific-rules)
[^agents]: [How Claude remembers your project: When Claude Code reads AGENTS.md](https://code.claude.com/docs/en/memory#when-claude-code-reads-agentsmd)
