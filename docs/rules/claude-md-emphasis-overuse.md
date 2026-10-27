---
type: Reference
description: The ESLint rule claude/claude-md-emphasis-overuse, off in recommended and warn in strict, which reports a CLAUDE.md or CLAUDE.local.md file in which more lines than the max option use emphasis words such as IMPORTANT or MUST, and makes no report when max is not set.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# claude/claude-md-emphasis-overuse

📝 Do not use emphasis words on many lines of a CLAUDE.md.

⚠️ This rule _warns_ in the 🔒 `strict` config.

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| practice | `**/CLAUDE.md`, `**/CLAUDE.local.md` |

The rule is `off` in `recommended`.

## Rule details

The best practices page says that adding IMPORTANT to a line that Claude ignores "probably
won't fix" it.[^short] It also says that "piling on emphasis mostly makes Claude over-apply the
rule".[^stop] The docs give no number of lines. So the rule has the option `max` and no default. **The rule makes no
report when `max` is not set.**

The rule counts the lines of the file that use emphasis. A line counts once, however many
emphasis words it has. A line has emphasis in these cases:

- It has one of these words, in capitals and as a whole word: `IMPORTANT`, `CRITICAL`, `MUST`,
  `NEVER`, `ALWAYS`, `SHALL`, `REQUIRED` or `DO NOT`.
- It starts a strong or emphasis span (`**NO EXCEPTIONS**`, `_ONLY_`) with at least three letters,
  all in capitals.

The rule reports once, when the count is more than `max`. The report is on the first line past
`max`, and the message gives the count and the limit.

The rule makes no report in these cases:

- The word is in lower case, or is part of a longer word, such as `MUSTARD`. Other capital words
  such as `API` or `JSON` do not count, unless they are a bold or italic span of three or more
  capital letters.
- The word is in a code span, a fenced block, an indented code block or an HTML comment.
- The file is not a `CLAUDE.md`, a `.claude/CLAUDE.md` or a `CLAUDE.local.md`.

The rule is a heuristic. It reads words, so a line can use a capital word with no intent to
emphasize.

Fail, with `max` set to 2, when the file has three of these lines:

```markdown
- IMPORTANT: run the tests.
- You MUST use pnpm.
- NEVER edit generated files.
```

Pass, with the same limit:

```markdown
- IMPORTANT: run the tests.
- Use pnpm.
- Do not edit generated files.
```

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/claude-md-emphasis-overuse': 'warn'
```

## Options

<!-- begin auto-generated rule options list -->

| Name  | Description                                                               | Type    |
| :---- | :------------------------------------------------------------------------ | :------ |
| `max` | The most lines with emphasis words. Without it, the rule makes no report. | Integer |

<!-- end auto-generated rule options list -->

```js
'claude/claude-md-emphasis-overuse': ['warn', { max: 5 }]
```

Without `max`, the rule does nothing. The message always gives the configured limit, because the
docs give no limit of their own.

## Sources

[^short]: [Best practices for Claude Code: Keep CLAUDE.md short](https://code.claude.com/docs/en/best-practices#keep-claude-md-short)
[^stop]: [Best practices for Claude Code: What you can stop doing](https://code.claude.com/docs/en/best-practices#what-you-can-stop-doing)
