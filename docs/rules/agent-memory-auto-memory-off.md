---
type: Reference
description: The ESLint rule claude/agent-memory-auto-memory-off, which reports a local subagent file that sets memory while the committed settings turn auto memory off, because the memory field then has no effect.
owner: brianespinosa
created: 2026-10-05
related_issues: [9]
stale_after: 2027-04-01
generated:
  by: claude-code
  at: 2026-10-05T00:00:00Z
---

# `agent-memory-auto-memory-off`

Do not set `memory` in a local agent when the settings turn auto memory off.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/agents/**/*.md` |

## Rule details

Subagent memory is part of auto memory. When auto memory is off, the `memory` field has no effect.
The subagent starts without the memory instructions and without the memory tool access.[^memory]
The setting `autoMemoryEnabled` and the variable `CLAUDE_CODE_DISABLE_AUTO_MEMORY` turn auto memory off.

The rule reports the `memory` field of a local agent in `.claude/agents/`. The value must be `user`,
`project` or `local`. The rule reports when `.claude/settings.json` or `.claude/settings.local.json`
sets `autoMemoryEnabled` to `false`. It also reports when the `env` key sets
`CLAUDE_CODE_DISABLE_AUTO_MEMORY` to `1` or `true`, in any case. The rule does not report other
values, such as `0`.

The rule reads both settings files of the `.claude/` directory that holds the agent. When both files
set a key, the local file wins.[^precedence] A local file that sets `autoMemoryEnabled` to `true` turns off only the report for that key.
The report for the variable stays. The two `env` objects merge by key. The settings page calls `env` an ordinary key, so a local `env`
could replace the project `env`. The merge by key is the choice of the plugin. The rule reads no managed or user settings, because they are not in the repository.

The rule reports local agents only. A plugin agent gets no report.

The rule makes no report that rests on a settings file that it cannot see. A file cannot be seen
when it cannot be read, or when it is a link to a file that is not there. A file also cannot be seen
when its real path is out of the repository, or when it does not parse to an object. A file that is
not there gives no report. The rule adds no message for this case.

Fail, with `{"autoMemoryEnabled": false}` in `.claude/settings.json`:

```markdown
---
name: reviewer
description: Reviews code.
memory: project
---
```

Pass: the same agent without `memory`, or settings that keep auto memory on.

## Options

None.

## Sources

[^memory]: [Create custom subagents: Enable persistent memory](https://code.claude.com/docs/en/sub-agents#enable-persistent-memory)
[^precedence]: [Claude Code settings: Settings precedence](https://code.claude.com/docs/en/settings#settings-precedence)
