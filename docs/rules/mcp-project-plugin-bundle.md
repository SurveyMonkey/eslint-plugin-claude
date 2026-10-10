---
type: Reference
description: The ESLint rule claude/mcp-project-plugin-bundle, which reports an MCP bundle (.mcpb or .dxt), an absolute path and a link out of the plugin in the mcpServers of a plugin under .claude/skills/, because Claude Code skips that server.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-project-plugin-bundle`

Declare the MCP servers of a project plugin inline or in a `.mcp.json`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/skills/*/.claude-plugin/plugin.json` |

## Rule details

A plugin directory under the `.claude/skills/` of a project is checked into the repository. It
reaches every person who clones the repository. So its MCP servers go through the same approval as
a project `.mcp.json`. Claude Code skips a server that such a plugin declares as an MCP bundle, a
`.mcpb` or `.dxt` file.[^loading] The plugin must declare the server inline, or in a `.mcp.json`
inside the plugin directory.[^loading]

The `mcpServers` key of `plugin.json` takes a path to a `.json` file, a path or URL of an MCP
bundle, an inline map, or an array that mixes them.[^manifest] The rule reports each string item
whose path ends in `.mcpb` or `.dxt`. The report is on that string. A bundle URL counts when the
path of the URL ends in one of these extensions. A query or a fragment is not part of the path.
The extension match is in lower case.

The rule makes no report for a `.json` path inside the plugin, for an inline map, or for a value
that is not a string. When a file has two `mcpServers` keys, the rule reads the last, as
`JSON.parse` does. A string that is a bundle gets the bundle report only.

### Paths out of the plugin directory

Claude Code also skips a server "from a file outside the plugin directory". It rejects a path that
resolves out of the plugin root. This includes a link that leads out of the plugin.[^escape] The
rule reports two of these cases, which `claude plugin validate` does not report:

- An absolute path, such as `/opt/servers.json`, `C:\mcp\servers.json` or `//host/share/s.json`.
  The rule reads the text only. It makes no report for an absolute path that points into the plugin
  directory.
- A relative path that leads out of the plugin through a link, while the real path stays in the
  repository. The rule reads the real path of the link for this case.

The rule reads no file out of the repository (ADR 001, Decision 14). It makes no report for a link
with a real path out of the repository, for a dangling link, or for a path that is not there.

The rule does not check a path with `..`. `claude plugin validate` reports it as
`Path contains ".." which could be a path traversal attempt`.[^containment]

The rule reads the directory `.claude/skills/<plugin>/` only. This is the place where the docs name
a skills-directory plugin of a project. A plugin in `~/.claude/skills/` is personal, and the
restrictions do not apply to it. The files glob also matches a `.claude` folder in a home
directory. The rule cannot tell it from a project folder. Turn the rule off for such a file.

Fail, in `.claude/skills/deploy/.claude-plugin/plugin.json`:

```json
{
  "name": "deploy",
  "mcpServers": ["./deploy-server.mcpb", "/opt/deploy/servers.json"]
}
```

Pass:

```json
{
  "name": "deploy",
  "mcpServers": {
    "deploy-api": { "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/server.js"] }
  }
}
```

## Sources

[^loading]: [Plugin loading reference: Plugins shared through a repository](https://code.claude.com/docs/en/plugins/loading#plugins-shared-through-a-repository)
[^manifest]: [Plugin manifest reference: mcpServers](https://code.claude.com/docs/en/plugins/manifest-reference#mcpservers)
[^escape]: [Plugin loading reference: Paths that escape the plugin directory](https://code.claude.com/docs/en/plugins/loading#paths-that-escape-the-plugin-directory)
[^containment]: [Plugin manifest reference: Containment and existence](https://code.claude.com/docs/en/plugins/manifest-reference#containment-and-existence)
