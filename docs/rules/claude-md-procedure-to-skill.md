---
type: Reference
description: The ESLint rule claude/claude-md-procedure-to-skill, off in recommended and warn in strict, which reports a numbered list in a CLAUDE.md or CLAUDE.local.md file that has more steps than the maxSteps option, because the docs say to move a multi-step procedure into a skill or a scoped rule, and makes no report when maxSteps is not set.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `claude-md-procedure-to-skill`

Move a long numbered procedure from a CLAUDE.md into a skill or a path-scoped rule.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | practice | `**/CLAUDE.md`, `**/CLAUDE.local.md` |

The rule is `off` in `recommended`.

## Rule details

The docs tell you to keep CLAUDE.md to facts that Claude holds in every session. A multi-step
procedure, or a rule for one part of the code, goes in a skill or in a path-scoped rule.[^when]
The docs give no number of steps. So the rule has the option `maxSteps` and no default. **The rule
makes no report when `maxSteps` is not set.**

The rule reads the syntax tree. It reports each ordered list that has more items than `maxSteps`,
over the whole list. A step is one item of the list. A list that a paragraph splits is two lists.
A list inside an item is a list of its own, and it does not add to the steps of its parent. The
rule does not count a bullet list.

The rule makes no report in these cases:

- A numbered line is in a fenced block, a code block or an HTML comment. These are not lists.
- The file is not a `CLAUDE.md`, a `.claude/CLAUDE.md` or a `CLAUDE.local.md`. The rule does not
  read a rule file, even one named `CLAUDE.md` below `.claude/rules/`.

The rule is a heuristic. A numbered list is not always a procedure.

Fail, with `maxSteps` set to 3:

```markdown
1. Run the tests.
2. Build the package.
3. Bump the version.
4. Tag the release.
```

Pass, with the same limit:

```markdown
1. Run the tests.
2. Build the package.
3. Bump the version.
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `maxSteps` | none | The most items in one numbered list. An integer from 1. |

```js
'claude/claude-md-procedure-to-skill': ['warn', { maxSteps: 7 }]
```

Without `maxSteps`, the rule does nothing. The message always gives the configured limit, because
the docs give no limit of their own.

## Sources

[^when]: [How Claude remembers your project: When to add to CLAUDE.md](https://code.claude.com/docs/en/memory#when-to-add-to-claude-md)
