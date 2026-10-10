---
type: Reference
description: The ESLint rule claude/sandbox-platform-limits, which with the options platforms and minVersion reports a sandbox setting that the platform or the Claude Code version does not honor, such as a wildcard in allowWrite on Linux and WSL2, a trailing slash on a deny path before v2.1.224, a bracketed IPv6 entry before v2.1.229, or failIfUnavailable on native Windows.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `sandbox-platform-limits`

Do not rely on a sandbox setting that the platform or the Claude Code version does not honor.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule skips a hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

No file shows the platform of a team, or the oldest client that reads the file. So each part of the rule has an option, and a
part with no option makes no report. The `recommended` and `strict` configs set no option, so they report nothing here.

### Parts that need `platforms`

`platforms` holds `windows-git-bash`, `windows-no-git-bash`, `macos`, `linux` or `wsl`. The value `wsl` means WSL2, the only WSL
that the sandbox supports.[^wsl]

| Platforms | What the rule reports |
|-----------|-----------------------|
| `linux`, `wsl` | An `allowWrite` or `denyWrite` entry with `*`, `?` or `[`, after Claude Code removes a trailing `/**`. The sandbox mounts concrete paths, so Claude Code skips the entry and it has no effect.[^prefixes] |
| `linux`, `wsl` | An `Edit` `allow` or `deny` rule with the same characters, while `sandbox.enabled` is `true` in the same file. Claude Code adds the path of an `Edit` rule to those lists, so the same limit applies.[^prefixes] |
| `linux`, `wsl` | A non-empty `allowUnixSockets`. Claude Code ignores it there. The docs name `allowAllUnixSockets` as the other way.[^unix] |
| `windows-git-bash`, `windows-no-git-bash` | `failIfUnavailable: true`. The sandbox does not run on native Windows, so Claude Code exits at startup.[^enforce] The rule does not check `sandbox.enabled` for this part. |

`denyRead` and `allowRead` are not read: wildcards work there on every platform.[^prefixes] The rule skips an `Edit` `allow` rule
that a `deny` or `ask` rule covers, which `permissions-dead-allow` reports. It skips a hidden drop-in.

### Parts that need `minVersion`

`minVersion` is the oldest Claude Code version that reads your files, as `major.minor.patch`.

| `minVersion` below | What the rule reports |
|--------------------|-----------------------|
| `2.1.224` | A `denyRead` or `denyWrite` entry that ends in `/`. Before v2.1.224, Claude Code passed the slash to the sandbox, and Claude could still read or write paths under the entry.[^prefixes] |
| `2.1.229` | A bracketed IPv6 entry, such as `[::1]`, in `allowedDomains` or `deniedDomains`, and in a `WebFetch(domain:...)` rule of `allow` or `deny`. The bracketed form needs v2.1.229 or later.[^allowed] [^ipv6] |

### Not checked

- WSL1. The sandbox needs WSL2, and `failIfUnavailable` stops Claude Code there too.[^wsl] The `platforms` values cannot tell WSL1 from WSL2.
- `ask` rules. The docs name `Edit` allow rules. The rule reads `Edit` deny rules too, and skips `ask` rules.
- A deny path with a trailing `/**`, because Claude Code removes it.[^prefixes]

Fail, with `platforms: ["linux"]`:

```json
{ "sandbox": { "filesystem": { "allowWrite": ["/tmp/build/*.o"] } } }
```

Pass, with `platforms: ["linux"]`:

```json
{ "sandbox": { "filesystem": { "allowWrite": ["/tmp/build"] } } }
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `platforms` | unset | The platforms where the team runs Claude Code. An array of `windows-git-bash`, `windows-no-git-bash`, `macos`, `linux`, `wsl`. |
| `minVersion` | unset | The oldest Claude Code version of the team, as `major.minor.patch`. |

```js
"claude/sandbox-platform-limits": ["warn", { platforms: ["linux", "macos"], minVersion: "2.1.200" }]
```

## Sources

[^prefixes]: [All settings: Sandbox path prefixes](https://code.claude.com/docs/en/settings-reference#sandbox-path-prefixes)
[^unix]: [All settings: sandbox.network.allowUnixSockets](https://code.claude.com/docs/en/settings-reference#sandbox-network-allowunixsockets)
[^allowed]: [All settings: sandbox.network.allowedDomains](https://code.claude.com/docs/en/settings-reference#sandbox-network-alloweddomains)
[^ipv6]: [Configure the sandboxed Bash tool: IPv6 addresses in domain lists](https://code.claude.com/docs/en/sandboxing#ipv6-addresses-in-domain-lists)
[^enforce]: [Configure the sandboxed Bash tool: Enforce sandboxing with managed settings](https://code.claude.com/docs/en/sandboxing#enforce-sandboxing-with-managed-settings)
[^wsl]: [Configure the sandboxed Bash tool: Set up Linux and WSL2](https://code.claude.com/docs/en/sandboxing#set-up-linux-and-wsl2)
