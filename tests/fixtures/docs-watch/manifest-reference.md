> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Plugin manifest reference

> Complete reference for plugin.json: every field with its type and default.

A plugin manifest is the `plugin.json` file in a plugin's `.claude-plugin/` directory.

## Component path forms

Component paths take these forms.

```json theme={null}
{
  "agents": ["./custom-agents/reviewer.md"]
}
```

### `commands`

`commands` takes a path, an array of paths, or an object map.

```md
## Not a heading, because it is in a code fence
```

### `hooks`

`hooks` takes a `.json` file path, an inline hooks object, or an array mixing both.

### Unrecognized fields

An unknown field is a warning.

## Path rules

### Unrecognized fields

An unknown path field is a warning too.
