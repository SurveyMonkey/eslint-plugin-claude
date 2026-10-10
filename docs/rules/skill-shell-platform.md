---
type: Reference
description: The ESLint rule claude/skill-shell-platform, which reports a skill or command with injected commands whose shell key fails or does not apply on a platform that the repository targets, with its option, examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [50]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `skill-shell-platform`

Set a shell that the target platforms of a skill can run.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/SKILL.md`, `**/commands/**/*.md` |

The rule makes no report until the option `platforms` lists a platform.

## Rule details

A skill can run a command when the skill runs, with `` !`command` `` or a ```` ```! ```` block.
The `shell` key picks the tool that runs the commands.[^injected][^field] Two values depend on the
platform:

- `shell: bash` fails the invocation on Windows without Git Bash. It fails before any command
  runs.
- `shell: powershell` runs the commands in PowerShell only when the PowerShell tool is on. On
  macOS, Linux, WSL, Amazon Bedrock, Google Cloud's Agent Platform and Microsoft Foundry, the tool
  is off until `CLAUDE_CODE_USE_POWERSHELL_TOOL=1`. The commands then run in Bash.[^field][^tool]

The rule reports the value of `shell` when the file has an injected command. The option
`platforms` must list a platform where the value fails. A file with no `shell` key gets no
report. Claude Code then picks the tool that works.

The rule cannot read the environment of a user. So a team lists only the platforms where it does
not set `CLAUDE_CODE_USE_POWERSHELL_TOOL`. On macOS, Linux and WSL, the PowerShell tool also needs
PowerShell 7 (`pwsh`) on the path.[^tool]

The rule is silent in these cases:

- The file has no injected command.
- The `shell` value is not `bash` or `powershell`. [`skill-frontmatter-schema`](skill-frontmatter-schema.md) reports it.
- A frontmatter block that does not parse. The `shell` value is not known then.
- An injected command in a code span, such as ``` ``!`cmd` `` ```.
- An injected command not at the start of a line or after whitespace.
  [`skill-inject-bang-position`](skill-inject-bang-position.md) reports it.

Fail, with `platforms: ['macos']`:

```markdown
---
shell: powershell
---

!`Get-Date`
```

Pass: the same file with no `shell` key, or with `shell: bash`.

## Options

| Option | Default | Use |
|--------|---------|-----|
| `platforms` | unset | A list of `windows-no-git-bash`, `macos`, `linux`, `wsl`, `bedrock`, `vertex` and `foundry`. Optional. |

```js
'claude/skill-shell-platform': ['warn', { platforms: ['windows-no-git-bash', 'macos', 'linux'] }]
```

With no `platforms`, the rule is inactive and makes no report. The `recommended` and `strict`
configs set no option. A team turns the rule on when it names its platforms. The platform
`windows-no-git-bash` makes the rule report `shell: bash`. Each other platform makes it report
`shell: powershell`.

## Sources

[^injected]: [Extend Claude with skills: How injected commands run](https://code.claude.com/docs/en/skills#how-injected-commands-run)
[^field]: [Extend Claude with skills: Frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference)
[^tool]: [Tools reference: Shell selection in settings, hooks, and skills](https://code.claude.com/docs/en/tools-reference#shell-selection-in-settings-hooks-and-skills)
