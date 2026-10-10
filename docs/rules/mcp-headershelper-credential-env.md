---
type: Reference
description: The ESLint rule claude/mcp-headershelper-credential-env, which reports an inline headersHelper that reads a variable with TOKEN, SECRET, PASSWORD, KEY or AUTH in its name, because Claude Code removes it from the environment of a helper from a project or plugin.
owner: brianespinosa
created: 2026-10-10
related_issues: [16]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `mcp-headershelper-credential-env`

Do not read a credential variable in an inline `headersHelper`.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.mcp.json` |

## Rule details

A `headersHelper` from a project `.mcp.json` or from a plugin is a command that the user did not
write. Claude Code runs it without the credential variables of the user. It removes each variable
whose name has `TOKEN`, `SECRET`, `PASSWORD`, `KEY` or `AUTH` in it, in either letter case. It keeps
`GIT_CONFIG_KEY_<n>`. It also removes a fixed list of variables, such as
`ANTHROPIC_CUSTOM_HEADERS`.[^env] The helper then reads an empty value and sends no credential.

The rule reports an inline `headersHelper` string that holds `$NAME` or `${NAME}` for a removed
variable. The report is on the string and names the variable. The rule reports each variable once
for each string.

The rule reads shell variable syntax only. It cannot see a read through `printenv`, `env`, or a
script that a path names. The rule does not know how the shell quotes a word, so `'$MY_TOKEN'` in single
quotes also counts. It skips a name that the command sets first, such as `token=$(get-token)`. The rule reads the fixed list in `src/data/mcp-credential-vars.ts`. That list holds
only `ANTHROPIC_CUSTOM_HEADERS`, the one name that the docs give.

The rule reads the `mcpServers` object of a project `.mcp.json` and of a plugin `.mcp.json`. A plugin
file may omit that wrapper. Of two servers with one name, or two keys with one name, the last one
counts. The rule makes no report when it cannot read the plugin-root directory. It skips the paths
under `.claude/`, which `mcp-json-location` reports.

Fail:

```json
{
  "mcpServers": {
    "internal": {
      "type": "http",
      "url": "https://mcp.internal.example.com",
      "headersHelper": "get-headers --token \"$MY_REGISTRY_TOKEN\""
    }
  }
}
```

Pass:

```json
{
  "mcpServers": {
    "internal": {
      "type": "http",
      "url": "https://mcp.internal.example.com",
      "headersHelper": "/opt/bin/get-mcp-auth-headers.sh"
    }
  }
}
```

## Sources

[^env]: [Connect Claude Code to tools via MCP: Which variables a helper can read](https://code.claude.com/docs/en/mcp#which-variables-a-helper-can-read)
