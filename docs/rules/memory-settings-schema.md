---
type: Reference
description: The ESLint rule claude/memory-settings-schema, which reports an autoMemoryEnabled that is not a Boolean, an autoMemoryDirectory that is not an absolute or ~/ path, a claudeMdExcludes that is not an array of strings, and an instructionFiles value that Claude Code does not know.
owner: brianespinosa
created: 2026-10-10
related_issues: [13]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `memory-settings-schema`

Give the memory keys of a settings file the types and values that Claude Code reads.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

The rule checks four memory settings in a settings file. Each check follows the settings
reference and the memory page.

- `autoMemoryEnabled` is a Boolean.[^enabled]
- `autoMemoryDirectory` is a string that is an absolute path or starts with `~/`.[^directory] The
  rule accepts a path that starts with `/`, a Windows drive and a separator (`C:\` or `C:/`), or
  two backslashes (a Windows share).
- `claudeMdExcludes` is an array of strings.[^excludes] The rule reports each entry that is not a
  string. [`claude-md-excludes-pattern`](claude-md-excludes-pattern.md) checks the patterns.
- `instructionFiles` in the options of the built-in plugin that reads `AGENTS.md` is
  `claude-md-or-agents-md`, `claude-md-and-agents-md`, `claude-md` or `managed-only`.[^load] The
  setting is `pluginConfigs["cc-plugin-agents-md@builtin"].options.instructionFiles`. Before
  Claude Code v2.1.285, the plugin ID was `agents-md@builtin`. Later versions read an entry under
  either ID, so the rule checks both.[^plugin]

The report is on the value. A key with the value `null` reads as unset, and the rule makes no
report on it. If a file sets a key twice, the rule reads the last one, as `JSON.parse` does. The
rule makes no report on a hidden drop-in in `managed-settings.d/`, because Claude Code ignores that
file.

The rule does not check where a key is allowed. Claude Code ignores a `pluginConfigs` entry in a
project or local settings file.[^plugin] The settings group reports a key in a file that does not
read it.

Fail:

```json
{
  "autoMemoryEnabled": "false",
  "autoMemoryDirectory": "memory",
  "claudeMdExcludes": "**/legacy/CLAUDE.md"
}
```

Pass:

```json
{
  "autoMemoryEnabled": false,
  "autoMemoryDirectory": "~/my-memory-dir",
  "claudeMdExcludes": ["**/legacy/CLAUDE.md"]
}
```

## Options

None.

## Sources

[^enabled]: [Settings reference: autoMemoryEnabled](https://code.claude.com/docs/en/settings-reference#automemoryenabled)
[^directory]: [Settings reference: autoMemoryDirectory](https://code.claude.com/docs/en/settings-reference#automemorydirectory)
[^excludes]: [Settings reference: claudeMdExcludes](https://code.claude.com/docs/en/settings-reference#claudemdexcludes)
[^load]: [How Claude remembers your project: Choose which instruction files load](https://code.claude.com/docs/en/memory#choose-which-instruction-files-load)
[^plugin]: [Settings reference: pluginConfigs](https://code.claude.com/docs/en/settings-reference#pluginconfigs)
