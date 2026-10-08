---
type: Reference
description: The ESLint rule claude/marketplace-entry-component-paths, which reports a commands, agents, skills, outputStyles or themes path in a marketplace.json entry that has no ./ prefix, contains .., contains a backslash, does not exist, or resolves out of the marketplace through a link.
owner: brianespinosa
created: 2026-10-07
related_issues: [12]
stale_after: 2027-04-07
generated:
  by: claude-code
  at: 2026-10-07T00:00:00Z
---

# `marketplace-entry-component-paths`

Write the component paths of an entry as the plugin path rules require, to paths that exist.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude-plugin/marketplace.json` |

## Rule details

Every component path in a manifest is relative to the plugin root and starts with `./`.[^rules]
A path that resolves outside the plugin root does not load. A path that does not exist does not
load.[^containment] The entry fields `commands`, `agents`, `skills`, `outputStyles` and `themes`
take these paths. Claude Code drops a path that escapes the plugin directory and loads the rest of
the plugin.[^escapes] On macOS and Linux, Claude Code also rejects a component path with a
backslash.[^escapes]

The rule reads each object in `plugins` that has a relative `source`. It resolves the source from
the marketplace root, the directory that holds `.claude-plugin/`. A bare name resolves under
`metadata.pluginRoot`.[^relative] The `plugin.json` of the source does not matter, because the
entry paths follow the same rules in both cases. The rule checks each string in the five fields.
A field can hold one string or an array of strings. It reports the first fault of a path, on the
string:

- **The path does not start with `./`.** A path with a root slash, a drive letter or a network form
  is also here. The `skills` field also accepts `.`.[^rules]
- **The path contains `..`.** The docs call this the usual case of a path that escapes.
- **The path contains a backslash.** Write the path with forward slashes.
- **The path does not exist.** The rule resolves it from the plugin directory.
- **The path resolves out of the marketplace through a link.** Claude Code drops a link that leads
  outside the plugin and that the symlink rules of the marketplace do not allow.[^escapes] Those
  rules allow a link to another place in the same marketplace, so the rule reports a link
  that leaves the marketplace root only.[^symlinks]

The rule makes no report in these cases:

- **The value is not a path.** A value that is not a string or an array of strings, an element that
  is not a string, and the object map of `commands` give no report. The rule does not read the
  fields `hooks`, `mcpServers` and `lspServers`.
- **The source is not read.** A source that is not a relative path, a source that
  [`marketplace-relative-source-format`](marketplace-relative-source-format.md) reports, a source
  that does not exist, a source that is a file, and a source that leaves the marketplace root give
  no report. The rule needs a plugin directory to resolve a path from.
- **The rule cannot read a part of the path.** A link on the path that is dangling, a link with a
  real path out of the repository, and a part that fails to read give no report for the existence
  of that path. The rule reads no file out of the repository (ADR 001, Decision 14). With no
  `.git`, the repository is the marketplace root. The faults of the text of the path are still
  reported.
- **The manifest at the source does not parse to an object.** The rule then cannot read the source.

The docs say that `agents` takes `.md` files and that `skills` takes directories. The rule checks
that a path exists, and not its kind. When a key appears twice, the rule reads the last, as
`JSON.parse` does.

Fail:

```json
{
  "name": "acme",
  "owner": { "name": "Acme" },
  "plugins": [
    {
      "name": "formatter",
      "source": "./plugins/formatter",
      "commands": ["./commands/", "../shared/lint.md"],
      "agents": "agents/reviewer.md"
    }
  ]
}
```

Pass: the same file, with `"commands": ["./commands/"]` and `"agents": "./agents/reviewer.md"`,
where both paths are in `plugins/formatter`.

## Options

None.

## Sources

[^rules]: [Plugin manifest reference: Path rules](https://code.claude.com/docs/en/plugins/manifest-reference#path-rules)
[^containment]: [Plugin manifest reference: Containment and existence](https://code.claude.com/docs/en/plugins/manifest-reference#containment-and-existence)
[^escapes]: [Error reference: Path escapes plugin directory](https://code.claude.com/docs/en/errors#path-escapes-plugin-directory)
[^symlinks]: [Host and maintain a marketplace: Share files within a marketplace with symlinks](https://code.claude.com/docs/en/plugins/host-marketplace#share-files-within-a-marketplace-with-symlinks)
[^relative]: [Marketplace reference: Relative path plugin source](https://code.claude.com/docs/en/plugins/marketplace-reference#relative-path-plugin-source)
