---
type: Reference
description: The ESLint rule claude/plugin-evals-mock-server-exists, which reports a plugin manifest when a mocks directory of the eval suite of the plugin is named for an MCP server that the plugin does not declare, because the docs name the server in the MCP configuration of the plugin.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# `plugin-evals-mock-server-exists`

Name only servers of the plugin MCP configuration in the mocks of an eval suite.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude-plugin/plugin.json` |

## Rule details

An eval run answers the MCP tool calls of a plugin from mock files. A mock file is
`mocks/<server>/<tool>.md`, in the eval directory for the whole suite or in a case for that case.
The docs say that `<server>` is "the server's name in your plugin's MCP configuration".[^mocks]
Claude Code registers a substitute server under each server name. So a directory with another name
is a mock that no tool call reaches.

The lint target is the manifest, `.claude-plugin/plugin.json`. ESLint has no language for a
directory. The rule reports at the start of the manifest, once for each mock directory, and the
message names the directory and lists the declared servers.

The rule reads the servers that the plugin declares in these places:

- The `.mcp.json` at the plugin root. Its map is the `mcpServers` object, or the whole object when the
  file has no `mcpServers` member.
- The `mcpServers` key of the manifest: a path to a `.json` file, an inline map, or a list of them.

The rule compares the directory name with the server name as written, with its case. It reads the
mock directories in `mocks/` of the eval directory, and in `mocks/` of each case. The eval directory
is `evals/`, or the path in `experimental.evals`.[^dir] A case is a directory with a `prompt.md` or a
`case.yaml`. The directory `.replay/` holds saved answers of agent mocks, so it is no server.

The rule makes no report in these cases:

- The rule cannot read a source of servers. The `.mcp.json` can fail to read or to parse, or have a
  shape that is not a map. A string in `mcpServers` can name a bundle, a URL, a file that is not
  there, or a file that fails to parse. A report would rest on a server that the rule cannot see.
- The manifest is in no plugin root, or the eval directory is not there.
- The plugin root or the eval directory is a link out of the repository, or `mocks` is such a link
  (ADR 001, Decision 14). The rule does not enter a server directory that is a link.
- A `mocks` directory is not at the eval directory or at a case. A directory below a server
  directory, such as `fixtures/`, is no server.

### What the rule does not see

A marketplace entry can declare components of a plugin, and so can declare `mcpServers`. The rule
reads the plugin only and not its marketplace entry. A server that only the entry declares gets a
report. The docs also say, for the score of a run, "when each mocked server in the case is one your
plugin declares".[^score] The words suggest that a case can mock a server that the plugin does not
declare. The page that describes the mock files names the plugin configuration, so the rule follows
that page.[^mocks]

`claude plugin validate` passes a plugin with these faults (checked on Claude Code 2.1.296).

Fail: a plugin whose `.mcp.json` declares `github`, with a file `evals/mocks/tracker/create_issue.md`.

Pass: the same plugin with the file `evals/mocks/github/create_issue.md`.

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/plugin-evals-mock-server-exists': 'error'
```

## Options

None.

## Sources

[^mocks]: [Test plugins with evals: Mock MCP servers](https://code.claude.com/docs/en/plugin-evals#mock-mcp-servers)
[^score]: [Test plugins with evals: Score against the no-plugin baseline](https://code.claude.com/docs/en/plugin-evals#compare-against-a-no-plugin-baseline)
[^dir]: [Test plugins with evals: Use a different eval directory](https://code.claude.com/docs/en/plugin-evals#use-a-different-eval-directory)
