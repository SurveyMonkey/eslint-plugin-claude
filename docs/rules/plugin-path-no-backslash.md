---
type: Reference
description: The ESLint rule claude/plugin-path-no-backslash, which reports a component path in plugin.json that has a backslash, because Claude Code rejects such a path on macOS and Linux, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-path-no-backslash`

Write the component paths of `plugin.json` with forward slashes.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/.claude-plugin/plugin.json` |

## Rule details

On macOS and Linux, Claude Code rejects a component path that has a backslash anywhere in it.
This holds even when the path stays inside the plugin. The component then does not load. A plugin
whose component paths use Windows separators therefore loads on Windows only.[^loading] The
`/plugin` interface shows a `path escapes plugin directory` error.[^errors] The error ends with `its
path contains a backslash, which is not resolved reliably on this platform`.

`claude plugin validate` covers this in part (checked on Claude Code 2.1.296). It fails the manifest
with `Path not found`, because no file has the literal name with the backslash. It does not name
the backslash. It passes a path when a file with that literal name exists. The rule names the
cause.

The rule reads the paths of these keys of the manifest: `skills`, `commands`, `agents`, `hooks`,
`mcpServers`, `lspServers`, `outputStyles`, `workflows`, `experimental.themes` and
`experimental.monitors`. It reads the top-level `themes` and `monitors` keys too, because they
still load.[^fields] A path is a string, or a string in an array. For `commands`, a path is also
the `source` of each entry in the object map.[^commands] The report is on the path. The message
names the key and the path.

The rule makes no report in these cases:

- The string is an `http://` or `https://` URL. The `mcpServers` key takes the URL of a
  bundle.[^path-rules]
- The string is not a path. An inline hook, server, monitor or command entry has strings such as
  `command` and `description`, and the rule skips them. The `content` of a command is also skipped.
- The key is not a component key. The `icon` and `types` keys are not component paths, and
  `experimental.evals` is not a component path.[^path-rules]
- The path is in a marketplace entry. `marketplace-entry-component-paths` owns the paths of an
  entry in `marketplace.json`.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of the plugin
  root, of `.claude-plugin/` or of `plugin.json` can be out of the repository. The manifest can
  fail to parse.

When a key appears twice, the rule reads the last one, as `JSON.parse` does.

Fail: `"commands": ["./commands\\deploy.md"]`.

Pass: `"commands": ["./commands/deploy.md"]`.

## Options

None.

## Sources

[^loading]: [Plugin loading reference: Paths that escape the plugin directory](https://code.claude.com/docs/en/plugins/loading#paths-that-escape-the-plugin-directory)
[^errors]: [Errors: Path escapes plugin directory](https://code.claude.com/docs/en/errors#path-escapes-plugin-directory)
[^fields]: [Plugin manifest reference: Fields](https://code.claude.com/docs/en/plugins/manifest-reference#fields)
[^commands]: [Plugin manifest reference: commands](https://code.claude.com/docs/en/plugins/manifest-reference#commands)
[^path-rules]: [Plugin manifest reference: Path rules](https://code.claude.com/docs/en/plugins/manifest-reference#path-rules)
