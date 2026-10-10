---
type: Reference
description: The ESLint rule claude/plugin-path-var-braced, which reports a bare $CLAUDE_PLUGIN_ROOT or $CLAUDE_PLUGIN_DATA in the body of a plugin skill, command or agent, because Claude Code substitutes only the braced form and a Bash command has no such variable.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-path-var-braced`

Write the plugin path variables of plugin Markdown in the braced form.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/SKILL.md`, `**/commands/**/*.md`, `**/agents/**/*.md` |

## Rule details

In the Markdown body of a plugin skill, command or agent, Claude Code substitutes the reference
`${CLAUDE_PLUGIN_ROOT}` with a path. It does this when it loads the content.[^resolve] The
variables are not in the environment of a command that Claude runs through the Bash tool. This
holds in the main session and in a subagent.[^resolve] So a bare `$CLAUDE_PLUGIN_ROOT` in the body
stays literal text. When Claude copies it into a Bash command, the shell reads an unset variable.

The rule reports each `$CLAUDE_PLUGIN_ROOT` and `$CLAUDE_PLUGIN_DATA` in the body. The rule reads
the whole body, fenced code included, because Claude copies a command from a code block. The
report is on the variable. The message gives the braced form to write. A name that continues the
variable, such as `$CLAUDE_PLUGIN_ROOT_DIR`, is another variable and gets no report.

The rule reads these files, when they belong to a plugin:

- `skills/<name>/SKILL.md`, and a `SKILL.md` at the plugin root.
- A Markdown file at any depth below `commands/`.
- A Markdown file at any depth below `agents/`.

The rule makes no report in these cases:

- A file in `.claude/skills/`, `.claude/commands/` or `.claude/agents/`, which is not in a plugin.
  `skill-plugin-vars-outside-plugin` reports the braced form in a skill or command file there. It
  reads the braced form only, and it reads no agent file.
- The frontmatter of the file, such as `allowed-tools`. The docs name the Markdown body.[^resolve]
  No shipped rule owns a bare variable in the frontmatter of a plugin skill.
- A `$CLAUDE_PLUGIN_ROOT` in a hook, an MCP server or a monitor. A hook and an MCP stdio server
  get the variables in their environment. `plugin-monitors-command-env` owns the monitor case.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of
  the plugin root, of `.claude-plugin/` or of `plugin.json` can be out of the repository. The manifest can fail to
  parse.

Fail: `Run $CLAUDE_PLUGIN_ROOT/scripts/check.sh` in `skills/check/SKILL.md` of a plugin.

Pass: `Run ${CLAUDE_PLUGIN_ROOT}/scripts/check.sh`.

## Options

None.

## Sources

[^resolve]: [Plugin manifest reference: Where each variable resolves](https://code.claude.com/docs/en/plugins/manifest-reference#where-each-variable-resolves)
