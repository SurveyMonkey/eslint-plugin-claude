---
type: Reference
description: The ESLint rule claude/sandbox-platform-limits, which with the options platforms and minVersion reports a sandbox setting that the platform or the Claude Code version does not honor, such as a wildcard in allowWrite on Linux and WSL2, a trailing slash on a deny path before v2.1.224, a bracketed IPv6 entry before v2.1.229, or failIfUnavailable on native Windows.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# claude/sandbox-platform-limits

📝 Do not rely on a sandbox setting that the platform or version does not honor.

⚠️ This rule _warns_ in the following configs: ✅ `recommended`, 🔒 `strict`.

<!-- end auto-generated rule header -->

| Category    | Files                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| portability | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule skips a hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

No file shows the platform of a team, or the oldest client that reads the file. So each part of the rule has an option, and a
part with no option makes no report. The `recommended` and `strict` configs set no option, so they report nothing here.

### Parts that need `platforms`

`platforms` holds `windows-git-bash`, `windows-no-git-bash`, `macos`, `linux` or `wsl`. The value `wsl` means WSL2, the only WSL
that the sandbox supports.[^wsl]

| Platforms                                 | What the rule reports                                                                                                                                                                                                                                                   |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `linux`, `wsl`                            | An `allowWrite` or `denyWrite` entry with `*` or `?`, after Claude Code removes a trailing `/**`. Only a trailing `/**` works in those lists. So `./src/*` covers only a file or directory in `src` that is itself named `*`.[^wildcards]                               |
| `linux`, `wsl`                            | An `Edit` `allow` or `deny` rule with the same characters, while `sandbox.enabled` is `true` in the same file. Claude Code adds the path of an `Edit` rule to those lists, so the same limit applies.[^wildcards]                                                       |
| `linux`, `wsl`                            | A `denyRead` or `allowRead` entry with an absolute path (`/` or `//`) whose first directory name holds `*`, `?` or `**`. A wildcard there works only after the first directory name of the full path, so `/**/*.pem` covers nothing. `/srv/**/*.pem` works.[^wildcards] |
| `linux`, `wsl`                            | A non-empty `allowUnixSockets`. Claude Code ignores it there. The docs name `allowAllUnixSockets` as the other way.[^unix]                                                                                                                                              |
| `windows-git-bash`, `windows-no-git-bash` | `failIfUnavailable: true`. The sandbox does not run on native Windows, so Claude Code exits at startup.[^enforce] The rule does not check `sandbox.enabled` for this part.                                                                                              |

The rule does not report a `[` in an `allowWrite` or `denyWrite` entry, or in an `Edit` rule. In a write list on Linux
and WSL2 it is part of a real directory name, so `./app/[slug]` covers the directory with that name.[^brackets] In a read list, the rule
skips a `~/` entry, a `./` entry and an entry with no prefix. The full path of each starts with a name of the home or
project path.[^prefixes] A trailing `/**` of a read entry works, so the rule removes it first.[^wildcards] The rule skips
an `Edit` `allow` rule that a `deny` or `ask` rule covers, which `permissions-dead-allow` reports. It skips a hidden
drop-in.

### Parts that need `minVersion`

`minVersion` is the oldest Claude Code version that reads your files, as `major.minor.patch`.

| `minVersion` below | What the rule reports                                                                                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `2.1.224`          | A `denyRead` or `denyWrite` entry that ends in `/`. Before v2.1.224, Claude Code passed the slash to the sandbox, and Claude could still read or write paths under the entry.[^prefixes]                  |
| `2.1.229`          | A bracketed IPv6 entry, such as `[::1]`, in `allowedDomains` or `deniedDomains`, and in a `WebFetch(domain:...)` rule of `allow` or `deny`. The bracketed form needs v2.1.229 or later.[^allowed] [^ipv6] |

### Not checked

- WSL1. The sandbox needs WSL2, and `failIfUnavailable` stops Claude Code there too.[^wsl] The `platforms` values cannot tell WSL1 from WSL2.
- `ask` rules. The docs name `Edit` allow rules. The rule reads `Edit` deny rules too, and skips `ask` rules.
- A deny path with a trailing `/**`, because Claude Code removes it.[^prefixes]
- A `[` in a read list. There it is a pattern on every platform, so it is not a limit of Linux and WSL2.[^brackets]
- A read entry with a reversed range in brackets, such as `[user-id]`. Before v2.1.304, sandboxed commands on Linux and
  WSL2 failed to start with such an entry. The rule has no part that needs both options.[^brackets]

Fail, with `platforms: ["linux"]`:

```json
{ "sandbox": { "filesystem": { "allowWrite": ["/tmp/build/*.o"] } } }
```

Pass, with `platforms: ["linux"]`:

```json
{ "sandbox": { "filesystem": { "allowWrite": ["/tmp/build"] } } }
```

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/sandbox-platform-limits': 'warn'
```

## Options

<!-- begin auto-generated rule options list -->

| Name         | Description                                                                  | Type   |
| :----------- | :--------------------------------------------------------------------------- | :----- |
| `minVersion` | The oldest Claude Code version that the team supports, as major.minor.patch. | String |
| `platforms`  | The platforms where the team runs Claude Code.                               | Array  |

<!-- end auto-generated rule options list -->

```js
"claude/sandbox-platform-limits": ["warn", { platforms: ["linux", "macos"], minVersion: "2.1.200" }]
```

## Sources

[^prefixes]: [All settings: Sandbox path prefixes](https://code.claude.com/docs/en/settings-reference#sandbox-path-prefixes)
[^wildcards]: [All settings: Where wildcards work in sandbox paths](https://code.claude.com/docs/en/settings-reference#where-wildcards-work-in-sandbox-paths)
[^brackets]: [All settings: Directory names with brackets, braces, or parentheses](https://code.claude.com/docs/en/settings-reference#directory-names-with-brackets-braces-or-parentheses)
[^unix]: [All settings: sandbox.network.allowUnixSockets](https://code.claude.com/docs/en/settings-reference#sandbox-network-allowunixsockets)
[^allowed]: [All settings: sandbox.network.allowedDomains](https://code.claude.com/docs/en/settings-reference#sandbox-network-alloweddomains)
[^ipv6]: [Configure the sandboxed Bash tool: IPv6 addresses in domain lists](https://code.claude.com/docs/en/sandboxing#ipv6-addresses-in-domain-lists)
[^enforce]: [Configure the sandboxed Bash tool: Enforce sandboxing with managed settings](https://code.claude.com/docs/en/sandboxing#enforce-sandboxing-with-managed-settings)
[^wsl]: [Configure the sandboxed Bash tool: Set up Linux and WSL2](https://code.claude.com/docs/en/sandboxing#set-up-linux-and-wsl2)
