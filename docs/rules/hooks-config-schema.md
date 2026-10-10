---
type: Reference
description: The ESLint rule claude/hooks-config-schema, which reports a hooks config that does not follow the shape of events, matcher groups and handlers, such as a matcher array, a missing handler type or field, a field of the wrong type, or a hooks.json without the hooks key.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-config-schema`

Write the hooks config as events, matcher groups and handlers.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

A hooks config has three levels. An event holds an array of matcher groups. A matcher group holds a
`hooks` array of handlers.[^configuration] The same shape is in the `hooks` key of a settings file, in
`hooks/hooks.json` of a plugin, and in the `hooks` field of skill and subagent frontmatter.[^settings][^skills] The
rule reads all of them. It reports at the value that is wrong.

The rule reports these faults:

- The `hooks` value is not an object.
- An event holds a value that is not an array.
- A matcher group is not an object, or it has no `hooks` array.
- A `matcher` is not a string. An array is the usual mistake. Claude Code lists the entry as an invalid
  setting. Under `PreToolUse` or `PermissionRequest`, none of the other hooks of the file load
  either.[^check] The message for those two events says so.
- A handler is not an object, has no `type`, or has a `type` that is not `command`, `http`, `mcp_tool`,
  `prompt` or `agent`.[^handlers]
- A handler lacks the field that its type needs: `command` for a command hook, `url` for an HTTP hook,
  `server` and `tool` for an MCP tool hook, and `prompt` for a prompt or agent hook.[^command][^http][^mcp][^prompt]
- A field has the wrong type. `timeout` is a number. `once`, `async`, `asyncRewake` and `continueOnBlock` are
  Booleans. `args` and `allowedEnvVars` are arrays of strings. `headers` and `input` are objects. `if`,
  `statusMessage`, `command`, `url`, `server`, `tool`, `prompt` and `model` are strings.[^common]
- `shell` is not `bash` or `powershell`.[^command] `onFailure` is not `continue` or `block`.[^onfailure]

A field with the wrong type is not also a missing field.

### hooks.json

A plugin keeps its hooks in `hooks/hooks.json` under a top-level `hooks` key.[^components] A file that holds only the
event map, with no `hooks` wrapper, fails to load.[^manifest][^load] The rule also reports a top-level key other than
`hooks`, `description`, `$schema` and `modules`, because the docs list no other key. The docs do not list `$schema`
for this file. The rule accepts it as a string, for editors. The `description` key is a string. A mod lists its code
under `modules`. The docs show an array with one path. The rule accepts an array of strings. A file with `modules`
needs no `hooks` key.[^mods]

The rule reads a `hooks.json` at the root of a plugin. It skips a file that Claude Code does not read (see
[`hooks-no-standalone-file`](hooks-no-standalone-file.md)). It skips a `hooks/hooks.json` in a hidden folder that holds
`hooks/` (other than `.claude`), such as `.github/hooks/`, because that file is for another tool.

### What the rule does not check

- An event name. [`hooks-event-name-known`](hooks-event-name-known.md) reports it.
- A handler field that the docs do not list. The rule checks the type of each listed field only.
- A matcher that is a string. The value of a matcher is for the matcher rules.
- A hidden file in `managed-settings.d/`. Claude Code ignores it.
- The `hooks` field of a plugin agent. Claude Code ignores it, and
  [`agent-plugin-ignored-fields`](agent-plugin-ignored-fields.md) reports it.
- The `hooks` field in a command file. The docs name skills and subagents only.

A `null` value for `hooks` removes the key, so it is no fault. When a file has two `hooks` keys or two events
of one name, the rule reads the last, as `JSON.parse` does.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": ["Edit", "Write"], "hooks": [{ "type": "command" }] }
    ]
  }
}
```

Pass:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "./scripts/check.sh" }]
      }
    ]
  }
}
```

## Sources

[^configuration]: [Hooks reference: Configuration](https://code.claude.com/docs/en/hooks#configuration)
[^handlers]: [Hooks reference: Hook handler fields](https://code.claude.com/docs/en/hooks#hook-handler-fields)
[^common]: [Hooks reference: Common fields](https://code.claude.com/docs/en/hooks#common-fields)
[^command]: [Hooks reference: Command hook fields](https://code.claude.com/docs/en/hooks#command-hook-fields)
[^http]: [Hooks reference: HTTP hook fields](https://code.claude.com/docs/en/hooks#http-hook-fields)
[^mcp]: [Hooks reference: MCP tool hook fields](https://code.claude.com/docs/en/hooks#mcp-tool-hook-fields)
[^prompt]: [Hooks reference: Prompt and agent hook fields](https://code.claude.com/docs/en/hooks#prompt-and-agent-hook-fields)
[^onfailure]: [Hooks reference: Block the action when a hook fails](https://code.claude.com/docs/en/hooks#block-the-action-when-a-hook-fails)
[^skills]: [Hooks reference: Hooks in skills and agents](https://code.claude.com/docs/en/hooks#hooks-in-skills-and-agents)
[^settings]: [All settings: hooks](https://code.claude.com/docs/en/settings-reference#hooks)
[^check]: [Debug your configuration: Check hooks](https://code.claude.com/docs/en/debug-your-config#check-hooks)
[^components]: [Add components to a plugin: Hooks](https://code.claude.com/docs/en/plugins/components#hooks)
[^manifest]: [Plugin manifest reference: hooks](https://code.claude.com/docs/en/plugins/manifest-reference#hooks)
[^load]: [Troubleshoot plugins: Hooks fail to load](https://code.claude.com/docs/en/plugins/troubleshooting#hooks-fail-to-load)
[^mods]: [Mods reference: Files](https://code.claude.com/docs/en/plugins/mods/reference#files)
