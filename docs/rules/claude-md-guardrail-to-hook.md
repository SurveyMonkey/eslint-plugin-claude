---
type: Reference
description: The ESLint rule claude/claude-md-guardrail-to-hook, off in recommended and warn in strict, which reports guardrail wording in a CLAUDE.md, CLAUDE.local.md or rule file, such as "never edit" a file or "always run" a step before a commit, because the docs say to enforce such a rule with a PreToolUse hook or a permission rule.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `claude-md-guardrail-to-hook`

Enforce a guardrail with a hook or a permission rule, not with CLAUDE.md text.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/CLAUDE.md`, `**/CLAUDE.local.md`, `**/.claude/rules/**/*.md` |

The rule is `off` in `recommended`.

## Rule details

Claude reads CLAUDE.md as context, not as enforced configuration. The docs say that to block an
action whatever Claude decides, you use a `PreToolUse` hook.[^context] A step that must run at a
fixed point, such as before every commit or after each file edit, is a hook too.[^follow] A hook is
a shell command that runs at a fixed event, whatever Claude decides to do.

The rule reports two shapes of wording, over the words that make the shape:

- A prohibition: `never`, `do not`, `don't`, `must not`, `should not`, `shall not` or `may not`,
  then `edit`, `modify`, `overwrite`, `write to`, `touch`, `delete`, `remove`, `commit`, `push`,
  `force-push`, `run` or `read`. A hook or a permission rule can check each of these verbs.
- A step at a fixed point: `always`, then `before` a commit, push, merge, finish or stop, or
  `after` each, every or any edit, change or write.

The rule reads a paragraph, a heading or a table cell, in any case of letters. It hides each code
span and each inline HTML tag, so a code span cannot split a sentence.

The rule makes no report in these cases:

- The wording is in a fenced block, an indented code block, a code span or an HTML comment.
- The wording is a rule that no hook can check, such as `Never use var` or `Always write clear
  names`.
- The file is not a `CLAUDE.md`, a `CLAUDE.local.md` or a file below `.claude/rules/`.

The rule is a heuristic. It reads words, and the docs do not define the wording of a guardrail. A
sentence can match when a hook is not worth the work.

Fail:

```markdown
Never edit the lock file.
Always run the tests before committing.
```

Pass:

```markdown
Use pnpm to install packages.
```

## Sources

[^context]: [How Claude remembers your project: Claude isn't following my CLAUDE.md](https://code.claude.com/docs/en/memory#claude-isnt-following-my-claude-md)
[^follow]: [Extend Claude Code: Compare similar features](https://code.claude.com/docs/en/features-overview#compare-similar-features)
