---
type: Reference
description: The ESLint rule claude/mcp-json-file-size, which reports a .mcp.json of more than 2 MiB (2097152 bytes), the size at which claude mcp add, add-json and remove refuse the file, with the max option.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-json-file-size`

Keep a `.mcp.json` file at or under 2 MiB.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | limit | `**/.mcp.json` |

## Rule details

A command that reads the `.mcp.json` of the project exits with an error when the file is larger
than 2 MiB. These are `claude mcp add`, `claude mcp add-json` with `--scope project`, and
`claude mcp remove`. The message is "Can't read .mcp.json: it isn't a regular file or is larger
than 2097152 bytes".[^error]

The rule counts the UTF-8 bytes of the file text. It reports a file of more than `max` bytes, once,
at the start of the file. A file of exactly 2097152 bytes passes.

ESLint removes a byte order mark before the rule runs, so the rule does not count its 3 bytes. A file
that is within 3 bytes of the limit can pass the rule and still be too large.

The same error page says that the path must be a regular file. A FIFO, or a link to a device file,
is refused. The rule cannot check that. ESLint reads the text of the file before the rule runs, so
the rule sees a regular file only.

A file that is not valid JSON gets a fatal parse error from the `json/json` language, and no rule
runs on it. So a file with a syntax error gets no size report.

The rule reads each `.mcp.json`, in a project and at a plugin root. It skips the paths under
`.claude/`, which `mcp-json-location` reports.

Fail, with the option `{ max: 100 }`, for a file of 101 bytes or more:

```json
{
  "mcpServers": {
    "db": { "command": "db-mcp", "args": ["--database", "a-long-name-for-the-configured-limit"] }
  }
}
```

Pass, in the same configuration:

```json
{
  "mcpServers": {}
}
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `max` | `2097152` | The most bytes of the file. An integer from 1 to 2097152. Optional. |

```js
'claude/mcp-json-file-size': ['error', { max: 1048576 }]
```

The default is the limit in the docs.[^error] The schema sets 2097152 as the maximum, because no
Claude Code setting moves that limit. A team can set a lower value. A config that sets only the
severity keeps the default. The `recommended` and `strict` configs set no option.

At the default, the message says which commands refuse a file of more than 2097152 bytes. At
another value, the message says "The configured limit is 1048576 bytes", and it does not say what
the docs allow.

## Sources

[^error]: [Error reference: Can't read .mcp.json](https://code.claude.com/docs/en/errors#cant-read-mcp-json)
