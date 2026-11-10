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

- A `CLAUDE.md` or `CLAUDE.local.md` in a subfolder of the start folder.[^end] Also the files
  that it imports with `@path`, to the depth of four hops.[^import]
- A `.claude/CLAUDE.md` in a subfolder. The docs name only `CLAUDE.md` and `CLAUDE.local.md`
  here.[^end] A probe of Claude Code 2.1.322 loads `pkg/.claude/CLAUDE.md` when Claude reads a
  file in `pkg/`, and not at launch. It loads `pkg/CLAUDE.md` in the same way. The docs also
  name `.claude/CLAUDE.md` as one of the three `CLAUDE.md` files of a folder.[^agents]
- A rule file in the `.claude/rules/` of a subfolder, with or without `paths`.[^end]
- A rule file with `paths` in the project `.claude/rules/`.[^paths] The rule reads an empty
  `paths` value as no scope. If the YAML does not parse, Claude Code loads the rule as if it
  had no `paths`.[^rule]

The rule stays silent on the files of the start folder that load at launch. These are its
`CLAUDE.md`, `.claude/CLAUDE.md` and `CLAUDE.local.md`, and the files that they import. A project
rule file with no `paths` also loads at launch.

The docs tell you to count the characters with `wc -m`.[^end] The rule counts as `wc -m` does in
a UTF-8 locale: one for each code point. So `é` counts one, not two bytes, and an emoji counts
one, not two UTF-16 units. A carriage return counts. The comparison is exact: a file of 40,000
characters passes, and a file of 40,001 reports. The report is at the start of the file. For an
imported file, the report is at the import of the linted file that leads to it. The report names
the imported file.

The start folder is where you start Claude Code. A lint run cannot know it, so the rule takes the
git top above the file as the start. Without a `.git`, the start is the folder that holds the
file, or that holds its `.claude/` folder. So, with no `.git`, only a project rule file with
`paths` can report. Other starts change the result:

- A session that starts in a subfolder of the repository has another start. The rule can then
  report a file that loads at launch.
- A session that starts above the git top loads the root `CLAUDE.md` on demand. The rule does
  not report that file.
- A subfolder with its own `.git`, such as a submodule, is a start folder to the rule. So the
  rule reads the `CLAUDE.md` files at the top of that subfolder as files that load at launch,
  and does not report them.

The rule can also report a file that loads at launch through an import. An example is a
subfolder `CLAUDE.md` that the root `CLAUDE.md` imports. The rule does not find which other
files import the linted file.

Not checked:

- The files in `~/.claude/rules/`, which are out of the repository (ADR 001, Decision 14). The
  rule follows no import into that folder.
- The imports of a rule file. The docs name the imports of a `CLAUDE.md` or `CLAUDE.local.md`
  file only.
- An imported file that is itself a `CLAUDE.md`, `CLAUDE.local.md` or rule file. The rule lints
  it on its own, or it loads at launch. If your ESLint config ignores that file, as ESLint
  ignores `node_modules/`, no check reads it.
- An imported file that the rule cannot read, or that is out of the repository.
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
200,000 characters on Claude Opus 4.6 and Claude Sonnet 4.6. On later models, it has
150,000.[^end]
The model of a session sets its context window, so the schema sets no maximum. Set `max` to the
limit of the window that your team uses. The `recommended` and `strict` configs set no option.

At the default, the message says that Claude gets only the start of a file of more than 40,000
characters. At another value, the message gives the configured limit and does not say what the
docs allow.

## Sources

[^end]: [How Claude remembers your project: Claude ignores the end of my subdirectory CLAUDE.md](https://code.claude.com/docs/en/memory#claude-ignores-the-end-of-my-subdirectory-claude-md)
[^import]: [How Claude remembers your project: Import additional files](https://code.claude.com/docs/en/memory#import-additional-files)
[^paths]: [How Claude remembers your project: Path-specific rules](https://code.claude.com/docs/en/memory#path-specific-rules)
[^rule]: [How Claude remembers your project: Rule frontmatter reference](https://code.claude.com/docs/en/memory#rules-frontmatter-reference)
[^agents]: [How Claude remembers your project: When Claude Code reads AGENTS.md](https://code.claude.com/docs/en/memory#when-claude-code-reads-agents-md)
