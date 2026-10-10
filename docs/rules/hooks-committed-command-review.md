---
type: Reference
description: The ESLint rule claude/hooks-committed-command-review, which asks for a review of each command hook that a repository commits, because a command hook runs with the full permissions of the user.
owner: brianespinosa
created: 2026-10-10
related_issues: [10]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `hooks-committed-command-review`

Review each command hook that the repository commits.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | security | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json`, `**/hooks/hooks.json`, `**/SKILL.md`, `**/agents/**/*.md` |

## Rule details

A command hook is a shell command that runs with the full permissions of the user. It can change or delete any
file that the user account can reach.[^disclaimer] Claude Code runs hooks outside the sandbox.[^plugin]

A hook in a repository is code that a person can run by opening the repository. In a `claude -p` or SDK session,
Claude Code shows no trust dialog. It runs the hooks of the project settings files and of a project skill in a
folder that nobody trusted.[^trust][^folder]

The rule reports each command hook in these places, at the handler:

- `.claude/settings.json`. The message says that the hook can run with no trust dialog.
- The frontmatter of a project skill. The message is the same.
- A plugin `hooks/hooks.json`, and the frontmatter of a skill in a plugin. The message asks for a review before
  the plugin is published or installed.[^plugin]
- The frontmatter of a project subagent. A subagent hook runs only after the user accepts the trust dialog, so
  the message does not claim that it runs with no dialog.[^folder]

The rule is a prompt to review, not a fault. A reviewed hook is correct. So the rule is `off` in `recommended`.
`strict` turns it on as a warning.

The rule makes no report in these cases:

- The file is `.claude/settings.local.json`. Nobody commits that file.
- The file is a managed settings file. An administrator sets it, not a repository.
- The handler is not a command hook. HTTP, MCP tool, prompt and agent hooks do not run a shell command.

The rule reads the same files as [`hooks-config-schema`](hooks-config-schema.md). It reads no hidden file in
`managed-settings.d/`, no plugin agent, and no `hooks.json` that Claude Code does not read.

Fail, in `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [{ "hooks": [{ "type": "command", "command": "./fmt.sh" }] }]
  }
}
```

Pass: the same hook in `.claude/settings.local.json`, or a file with no command hook.

## Sources

[^disclaimer]: [Hooks reference: Disclaimer](https://code.claude.com/docs/en/hooks#disclaimer)
[^trust]: [Hooks reference: Workspace trust](https://code.claude.com/docs/en/hooks#workspace-trust)
[^plugin]: [Plugin security and trust: Understand what a plugin can do](https://code.claude.com/docs/en/plugins/security#understand-what-a-plugin-can-do)
[^folder]: [Configure permissions: What runs before you trust a folder](https://code.claude.com/docs/en/permissions#what-runs-before-you-trust-a-folder)
