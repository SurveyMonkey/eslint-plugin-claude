---
type: Reference
description: The ESLint rule claude/plugin-bin-claude-ai, which with the option targets set to claude-ai reports a plugin that has a top-level bin folder, because claude.ai and Cowork do not install such a plugin.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-bin-claude-ai`

Do not ship a top-level `bin/` folder in a plugin that targets claude.ai.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/.claude-plugin/plugin.json` |

## Rule details

Files in the `bin/` folder at the plugin root are on the `PATH` of the Bash tool while the plugin is
enabled.[^executables] claude.ai and Cowork do not install a plugin that has a top-level `bin/`
folder. This holds for a plugin that you distribute through claude.ai organization
settings.[^layout] The rule reports a plugin whose root has a `bin` folder.

No manifest or marketplace field says that a plugin targets claude.ai. So the option `targets` names
the target, and the rule reports nothing when the option is unset. This is the same option as in
`mcp-plugin-stdio-reach`. Without the option, a `bin/` folder is correct
for a plugin that only Claude Code users install.

The report is on the manifest. The fix is to move the executables out of `bin/`, for example into
a folder with another name that the hooks call through `${CLAUDE_PLUGIN_ROOT}`, or to remove
`claude-ai` from the option.

The rule makes no report in these cases:

- The option `targets` does not hold `claude-ai`.
- The plugin has no `bin` folder at its root. A `bin` file, a nested `bin/` folder and the
  `.claude-plugin/bin/` folder are not the top-level folder.
- The `bin` entry is a link with no target, a link to a folder out of the plugin, or a path that the
  rule cannot read.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of
  the plugin root, of `.claude-plugin/` or of `plugin.json` can be out of the repository. The manifest can fail to
  parse.

Fail, with `targets: ["claude-ai"]`: a plugin root with `bin/hello-plugin`.

Pass: the same plugin with no option, or a plugin with no `bin/` folder.

## Options

An object with one property.

- `targets`: an array. The only value that it takes is `"claude-ai"`. The default is an empty array.
  The rule is active when the array holds `"claude-ai"`.

```json
{ "rules": { "claude/plugin-bin-claude-ai": ["warn", { "targets": ["claude-ai"] }] } }
```

## Sources

[^executables]: [Add components to a plugin: Executables](https://code.claude.com/docs/en/plugins/components#executables)
[^layout]: [Plugin manifest reference: Standard layout](https://code.claude.com/docs/en/plugins/manifest-reference#standard-layout)
