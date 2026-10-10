# Environment variables

> Set environment variables to control how Claude Code behaves.

## Set environment variables

Set a variable in your shell, or in a settings file.

### Set variables in your shell

Export the variable in your shell before you launch `claude`.

### Set variables in settings files

Add variables under the `env` key in a `settings.json` file, creating the file if it doesn't exist. Claude Code reads them directly from the file, so they take effect no matter how `claude` was launched. A running session applies new and changed values to its environment when you save the file, but a feature that reads its variables once at startup, such as [OpenTelemetry monitoring](/docs/en/monitoring-usage), keeps its startup values until you relaunch. Removing a variable from the file doesn't unset it in a running session; the removal takes effect the next time you launch `claude`.

```json ~/.claude/settings.json theme={null}
{
  "env": {
    "API_TIMEOUT_MS": "1200000",
    "BASH_DEFAULT_TIMEOUT_MS": "300000"
  }
}
```

Claude Code copies these values into its environment as written. No shell processes them, so shorthand such as `~` or `$HOME` stays as typed. For a variable that takes a path, such as `CLAUDE_CONFIG_DIR`, write the absolute path: `"CLAUDE_CONFIG_DIR": "/home/you/.claude-work"`.

The file you choose controls who the variables apply to:

| File | Applies to |
| :- | :- |
| `~/.claude/settings.json` | You, in every project |
| `.claude/settings.json` | Everyone working in the project, checked into source control |
| `.claude/settings.local.json` | You, in this project only, gitignored when Claude Code saves a setting to it; add it to your gitignore if you create it by hand |
| Managed settings | Everyone in your organization, deployed by an admin |

See [Settings files](/docs/en/settings#where-settings-live) for where each file lives and [Settings precedence](/docs/en/settings#settings-precedence) for how they combine when more than one sets the same variable.

## Variables

Claude Code reads the variables in this table.
