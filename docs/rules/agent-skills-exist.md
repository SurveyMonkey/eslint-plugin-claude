---
type: Reference
description: The ESLint rule claude/agent-skills-exist, which reports a skills entry of a subagent that names no bundled skill and no skill or command of the repository or plugin, because Claude Code skips such an entry, with an allow option for user skills.
owner: brianespinosa
created: 2026-10-10
related_issues: [9]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `agent-skills-exist`

Name a skill that exists in the `skills` of a subagent.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | consistency | `**/agents/**/*.md`, in `.claude/agents/` and in the `agents/` directory of a plugin |

The rule is `off` in `recommended`.

## Rule details

The `skills` field lists skills that Claude Code injects into the subagent at startup.[^preload]
The docs say: "If a listed skill is missing or disabled, Claude Code skips it and logs a warning to
the debug log". The warning is only in the debug log, so a misspelled name goes unseen.

The rule reports a `skills` entry that matches no skill that it can see. The report is on the entry.
The rule is a heuristic. It cannot see these skills:

- Skills in `~/.claude/skills/`.
- Skills in managed settings.
- Skills in an enabled plugin.
- Skills in a directory added with `--add-dir`.

Name such a skill in the option `allow`.

An entry matches in these places:

- A local agent sees `.claude/skills/` and `.claude/commands/` of the project folder. It sees the
  same of each folder above it, up to the repository root. An entry matches the name of a skill folder, or
  the `name` field of its `SKILL.md`. A folder with no `SKILL.md` is not a skill. It also matches
  the file name, without `.md`, of a command file in `commands/`. The skills page says that a command
  file and a skill create the same command.[^where]
- A plugin agent sees `skills/` and `commands/` of its plugin root. A plugin manifest that sets
  `skills` adds other directories. One that sets `commands` replaces `commands/`. The rule gives no
  report for that plugin in both cases.
- A bundled skill. The commands reference marks each bundled skill.[^commands] A project does not
  define one, so the rule accepts the name.

The docs do not say if Claude Code treats upper and lower case as different. The rule treats them
as the same.

The rule is silent in these cases:

- An entry with a `:`. It is a plugin skill or a command in a folder. The docs give no rule for that
  form in `skills`.
- An entry that is empty, or not a string.
- A `skills` value that is not a list. [`agent-frontmatter-schema`](agent-frontmatter-schema.md)
  reports it.
- A skill that sets `disable-model-invocation: true`. It exists, and a subagent cannot preload it.
  [`agent-skills-preloadable`](agent-skills-preloadable.md) reports that case.
- A `skills/` or `commands/` folder, or a `SKILL.md`, that the rule cannot read. The same holds
  when it leads out of the repository, or is a link whose target is not there. A plugin manifest that
  the rule cannot read gives no report either. The rule adds no message for these cases.

The rule does not check the total size of the preloaded skills. The docs give no size limit. The
docs limit the preload to "the first 32 distinct names in the list". The rule does not check that
number.

The rule reads no file out of the repository (ADR 001, Decision 14).

Fail, with no skill `api-conventions`:

```markdown
---
name: api-developer
description: Implement API endpoints with team conventions
skills:
  - api-conventions
---
```

Pass: the same agent with `.claude/skills/api-conventions/SKILL.md`.

## Options

| Option | Default | Use |
|--------|---------|-----|
| `allow` | `[]` | Names of skills that the repository cannot see, such as the skills in `~/.claude/skills/`. |

```js
'claude/agent-skills-exist': ['warn', { allow: ['my-user-skill'] }]
```

## Sources

[^preload]: [Create custom subagents: Preload skills into subagents](https://code.claude.com/docs/en/sub-agents#preload-skills-into-subagents)
[^where]: [Extend Claude with skills: Choose where skills load](https://code.claude.com/docs/en/skills#where-skills-live)
[^commands]: [Commands: All commands](https://code.claude.com/docs/en/commands#all-commands)
