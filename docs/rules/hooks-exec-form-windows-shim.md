---
type: Reference
description: The ESLint rule claude/hooks-exec-form-windows-shim, which reports a hook in exec form whose command is an npm .cmd or .bat shim, for the platforms that the option platforms names, because Windows cannot spawn a shim.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-exec-form-windows-shim`

Do not spawn an npm shim in exec form on Windows.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | portability | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

On Windows, exec form needs `command` to resolve to a real executable such as a `.exe`. The `.cmd` and `.bat`
shims that npm, npx, eslint and other tools install in `node_modules/.bin` are not executables. They cannot be
spawned without a shell.[^exec] The docs give two fixes. Run the underlying script with `node`, with its path in
`args`. Or use shell form.

The rule reports a `command` handler in exec form (`args` is an array) when `command` is one of these:

- A bare name in this list: `npm`, `npx`, `pnpm`, `pnpx`, `yarn`, `eslint`, `prettier` and `tsc`. The docs name
  `npm`, `npx` and `eslint`, and say "other tools". The other names are the choice of the plugin.
- A name that ends in `.cmd` or `.bat`.
- A path that holds `node_modules/.bin/`.

The rule reports at the `command` string. It makes no report for a handler in shell form.

### The option `platforms`

The result depends on the platform of your team, and the rule cannot know it. So the rule makes no report unless
the option `platforms` holds `windows-git-bash` or `windows-no-git-bash`. The docs say that exec form uses no shell on any
platform. The other values are `macos`, `linux` and `wsl`.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, and no plugin agent.

Fail, with `platforms: ["windows-git-bash"]`, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [{ "type": "command", "command": "npx", "args": ["prettier", "--check", "."] }]
      }
    ]
  }
}
```

Pass:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "node",
            "args": ["${CLAUDE_PROJECT_DIR}/node_modules/prettier/bin/prettier.cjs", "--check", "."]
          }
        ]
      }
    ]
  }
}
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `platforms` | none | The platforms where your team runs Claude Code. Values: `windows-git-bash`, `windows-no-git-bash`, `macos`, `linux`, `wsl`. Optional. |

```js
'claude/hooks-exec-form-windows-shim': ['warn', { platforms: ['windows-git-bash'] }]
```

The option has no default. A config that sets only the severity makes no report. The `strict` config sets no
option.

## Sources

[^exec]: [Hooks reference: Exec form and shell form](https://code.claude.com/docs/en/hooks#exec-form-and-shell-form)
