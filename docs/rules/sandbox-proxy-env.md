---
type: Reference
description: The ESLint rule claude/sandbox-proxy-env, a heuristic that reports the shared project settings file when the sandbox is on and a package.json script starts claude with HTTPS_PROXY, HTTP_PROXY or NO_PROXY set in the shell while no settings env block sets it, because a background agent does not get a shell variable reliably.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# claude/sandbox-proxy-env

📝 Set the proxy variables of a script that starts claude in the settings env block.

⚠️ This rule _warns_ in the 🔒 `strict` config.

<!-- end auto-generated rule header -->

| Category | Files |
|----------|-------|
| practice | `**/.claude/settings.json` |

The rule is `off` in `recommended`. It is a heuristic, so `strict` turns it on at `warn`.

## Rule details

Behind a corporate proxy, the docs say to set `HTTPS_PROXY`, `HTTP_PROXY` and `NO_PROXY` "in the `env` block of your settings so
that background agents get them too, or in the environment you launch Claude Code from".[^network] A shell variable reaches a
background agent only when that shell started the supervisor first, because the supervisor inherits the environment of the first
shell that starts it. The docs say to put the variables in the `env` block of `~/.claude/settings.json` or managed
settings.[^background]

The two pages differ. The sandboxing page also allows "the environment you launch Claude Code from", which is what a script
does. The network page says that settings are the only configuration that reaches every background session. The rule follows the
network page. The rule needs the sandbox on, because the proxy advice sits on the sandboxing page. That limit is the choice of
the plugin.

The rule lints the shared file `.claude/settings.json`. It reports when the sandbox is on in the project pair, a script starts
`claude` with a proxy variable set, and no `env` block of the pair sets that variable. The report names the variables that are not set. It
is on the `enabled` value, or on the top of the file when the other file turns the sandbox on.

A script is a string in the `scripts` of a tracked `package.json` in the folder that holds `.claude/` (the rule asks the git index,
`src/permission-project.ts`). The script must hold the word `claude`, and an assignment such as `HTTPS_PROXY=...`, `export HTTP_PROXY=...`
or `cross-env NO_PROXY=...`. The lower-case names work too, because the network page says so.[^network-config]

### What the rule does not read

- Shell scripts, `.envrc`, a `Makefile` and CI files. Only `package.json` is read.
- A script that sets a proxy variable but does not start `claude`: that proxy serves another tool.
- A user or managed settings file. The docs name those two files for the `env` block, and the rule cannot see them
  (ADR 001, Decision 14). A project `env` key counts as set here, even with an empty value, although the docs name the user and managed files. In a
  Claude Desktop session that the app manages, Claude Code ignores these variables in a repository file.[^network-config] The rule
  is `off` in `recommended` for these reasons.
- A project with no `.git`, or one where git cannot answer, a `package.json` that does not read, and a sibling settings file that
  does not read.
- The local file and the managed files. The shared file speaks for the project.

Fail, when git tracks this `package.json`:

```json
{ "scripts": { "claude": "HTTPS_PROXY=http://proxy.example.com:8080 claude" } }
```

with this settings file:

```json
{ "sandbox": { "enabled": true } }
```

Pass:

```json
{ "sandbox": { "enabled": true }, "env": { "HTTPS_PROXY": "http://proxy.example.com:8080" } }
```

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/sandbox-proxy-env': 'warn'
```

## Sources

[^network]: [Configure the sandboxed Bash tool: Network isolation](https://code.claude.com/docs/en/sandboxing#network-isolation)
[^background]: [Enterprise network configuration: Set network variables in settings, not the shell](https://code.claude.com/docs/en/network-config#set-network-variables-in-settings-not-the-shell)
[^network-config]: [Enterprise network configuration: Environment variables](https://code.claude.com/docs/en/network-config#environment-variables)
