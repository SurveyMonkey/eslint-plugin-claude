---
type: Reference
description: The ESLint rule claude/sandbox-allow-write-escalation, a heuristic that reports a sandbox allowWrite entry for a shell startup file, a system configuration directory, a directory of executables or a directory above them, because broad write access can lead to code execution in another context.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# claude/sandbox-allow-write-escalation

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| security | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule is `off` in `recommended`. It is a heuristic, so `strict` turns it on at `warn`.

## Rule details

The security limitations warn that "allowing writes to directories containing executables in `$PATH`, system configuration
directories, or user shell configuration files such as `.bashrc` or `.zshrc` can lead to code execution in different security
contexts".[^limits] The rule reads `sandbox.filesystem.allowWrite` and reports four shapes:

- `startup`: a startup file of a home directory: `.bashrc`, `.bash_profile`, `.bash_login`, `.profile`, `.zshrc`, `.zshenv`,
  `.zprofile`, `.zlogin` and `.config/fish/config.fish`. The docs name `.bashrc` and `.zshrc` and say "such as", so the
  other names are the choice of the plugin.
- `system`: `/etc`, or a path below it.
- `executables`: a usual directory of executables, or a path below it: `/bin`, `/sbin`, `/usr/bin`, `/usr/sbin`,
  `/usr/local/bin`, `/usr/local/sbin`, `/opt/homebrew/bin`, `~/bin` and `~/.local/bin`. The rule cannot read `$PATH`, so the
  list is the choice of the plugin.
- `broad`: a directory that holds those: `~`, `/`, `/usr`, `/usr/local`, and a home directory such as `/Users/me`.

A home directory is `~`, `/Users/<name>`, `/home/<name>` or `/root`. The list of home forms is the choice of the plugin. A
trailing `/` or `/**` does not change the result.[^prefixes] The prefix table has no `$HOME` form, so `$HOME/.zshrc` is a path
relative to the project and gets no report.

### What the rule does not report

- The docs examples `~/.kube` and `/tmp/build`, and a project path such as `./build`.[^configure]
- A startup file of the working directory (`./.zshrc`). The sandbox already denies writes to it, and an `allowWrite` entry
  does not lift that.[^protected]
- `denyWrite`, `allowRead` and `Edit` rules.
- An entry with a wildcard in the name. The rule reads the path as written.

Fail:

```json
{ "sandbox": { "filesystem": { "allowWrite": ["~/.zshrc"] } } }
```

Pass:

```json
{ "sandbox": { "filesystem": { "allowWrite": ["~/.kube", "/tmp/build"] } } }
```

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/sandbox-allow-write-escalation': 'warn'
```

## Sources

[^limits]: [Configure the sandboxed Bash tool: Security limitations](https://code.claude.com/docs/en/sandboxing#security-limitations)
[^prefixes]: [All settings: Sandbox path prefixes](https://code.claude.com/docs/en/settings-reference#sandbox-path-prefixes)
[^configure]: [Configure the sandboxed Bash tool: Configure sandboxing](https://code.claude.com/docs/en/sandboxing#configure-sandboxing)
[^protected]: [Configure the sandboxed Bash tool: Protected paths](https://code.claude.com/docs/en/sandboxing#protected-paths)
