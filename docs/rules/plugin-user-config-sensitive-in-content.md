---
type: Reference
description: The ESLint rule claude/plugin-user-config-sensitive-in-content, which reports a ${user_config.KEY} reference to a sensitive option in the body of a plugin skill or agent, because Claude Code writes a placeholder there and not the value.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-user-config-sensitive-in-content`

Keep the reference to a sensitive plugin option out of skill and agent content.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

A plugin can declare options in the `userConfig` key of `plugin.json`. An option with
`"sensitive": true` holds a token or a password.[^config] A component references a saved value as
`${user_config.KEY}`. Claude Code substitutes the reference in skill and agent content, but only for
a non-sensitive option. For a sensitive option, the reference becomes a placeholder.[^reference]
So the text that Claude reads does not hold the value.

The rule reports each `${user_config.KEY}` in the body of a plugin skill or agent when the manifest
declares `KEY` with `"sensitive": true`. The report is on the reference. A sensitive value can
reach a hook as `CLAUDE_PLUGIN_OPTION_<KEY>`, and it can reach an MCP or LSP server configuration.[^reference]
To fix the file, pass the value through one of these.

The rule reads these files:

- `SKILL.md` in `skills/<name>/` of a plugin, and `SKILL.md` at the plugin root.
- Each `.md` file in `agents/` of a plugin, at any depth.

The docs name skill and agent content only. The rule does not read a command file in `commands/`.
It reads the body and not the frontmatter, as `plugin-path-var-braced` does.

The rule makes no report in these cases:

- The option is not sensitive, or `sensitive` is not the value `true`.
- The manifest does not declare the option. That is another fault, and the rule does not check
  it.
- The file is a local skill or agent in `.claude/`, or a command, or a `SKILL.md` that is not in `skills/<name>/` and not at the plugin root.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of
  the plugin root, of `.claude-plugin/` or of `plugin.json` can be out of the repository. The
  manifest can fail to parse, or not be an object.

Fail: a skill that says `Call the API with ${user_config.api_token}`, with `api_token` declared as
`"sensitive": true`.

Pass: the same line for an option that is not sensitive.

## Options

None.

## Sources

[^config]: [Add components to a plugin: Ask the user for configuration values](https://code.claude.com/docs/en/plugins/components#user-configuration)
[^reference]: [Plugin manifest reference: Reference a saved value](https://code.claude.com/docs/en/plugins/manifest-reference#reference-a-saved-value)
