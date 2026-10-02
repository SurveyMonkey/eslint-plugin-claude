---
type: Reference
description: The ESLint rule claude/agent-permission-mode-bypass, which reports permissionMode bypassPermissions in a local subagent file, because Claude Code ignores it unless the main session already bypasses permissions, and older versions granted bypass.
owner: brianespinosa
created: 2026-10-01
related_issues: [9]
stale_after: 2027-04-01
generated:
  by: claude-code
  at: 2026-10-01T00:00:00Z
---

# `agent-permission-mode-bypass`

Do not set permissionMode to bypassPermissions in a local subagent.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | security | `**/agents/**/*.md` |

## Rule details

A subagent that sets `permissionMode: bypassPermissions` keeps the permission mode of the main
conversation, since Claude Code v2.1.267.[^modes] It runs in bypass mode only when the main
conversation does. Before v2.1.267, the value granted bypass. The field looks like a grant that
it does not make, and an older version of Claude Code still grants it. The rule reports the value.

Claude Code ignores `permissionMode` in a plugin agent. So the rule checks only agent files in
`.claude/agents/`, and [`agent-plugin-ignored-fields`](agent-plugin-ignored-fields.md) reports the
field in a plugin. A file outside these folders gets no report. The rule ignores a file whose
frontmatter does not parse.

Fail:

```markdown
---
name: deployer
description: Deploys.
permissionMode: bypassPermissions
---
```

Pass:

```markdown
---
name: deployer
description: Deploys.
permissionMode: acceptEdits
---
```

## Options

None.

## Sources

[^modes]: [Create custom subagents: Permission modes](https://code.claude.com/docs/en/sub-agents#permission-modes)
