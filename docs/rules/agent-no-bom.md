---
type: Reference
description: The ESLint rule claude/agent-no-bom, which reports a subagent file that starts with a UTF-8 byte-order mark when the option minVersion is below v2.1.239, because older Claude Code versions silently ignore such a file.
owner: brianespinosa
created: 2026-10-10
related_issues: [9]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `agent-no-bom`

Start an agent file with no byte-order mark, for older Claude Code versions.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/agents/**/*.md`, in `.claude/agents/` and in the `agents/` directory of a plugin |

## Rule details

A byte-order mark (BOM) is the three bytes `EF BB BF` at the start of a file. An editor can add it with no sign in
the text. Before Claude Code v2.1.239, an agent file with a BOM was silently ignored.[^skips] The
[changelog](https://code.claude.com/docs/en/changelog) records the fix under v2.1.239. The docs give no
other source for this fix, so the rule does not cite a changelog heading in its sources.

The rule reports the first character of the file when the file starts with a BOM. The rule applies only when the
option `minVersion` is set and is lower than `2.1.239`. With no `minVersion`, the rule is inactive. The file
does not show which Claude Code versions its users run.

ESLint removes the BOM from the text before a rule runs. So the rule reads the first three bytes of the file
on disk. This has two results:

- The rule reports the saved file, not an unsaved editor buffer.
- The rule makes no report for a file that it cannot read, such as text from standard input, or a file with no access
  mode.

The rule checks local agents and plugin agents. The fix of v2.1.239 names agents, skills and commands without a
distinction.

Fail, with `minVersion` set to `2.1.200` (the first byte of the file is the BOM):

```markdown
<U+FEFF>---
name: reviewer
description: Reviews code.
---
```

Pass:

```markdown
---
name: reviewer
description: Reviews code.
---
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `minVersion` | none | The lowest Claude Code version that the team supports, as `major.minor.patch`. Optional. |

```js
'claude/agent-no-bom': ['warn', { minVersion: '2.1.200' }]
```

With no `minVersion`, or with `2.1.239` or higher, the rule reports nothing. The `recommended` and `strict` configs
set no option, so they do not activate the rule. The message names the configured `minVersion`.

## Sources

[^skips]: [Create custom subagents: Subagent files Claude Code skips](https://code.claude.com/docs/en/sub-agents#subagent-files-claude-code-skips)
