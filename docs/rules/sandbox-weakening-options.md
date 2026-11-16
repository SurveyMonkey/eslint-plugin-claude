---
type: Reference
description: The ESLint rule claude/sandbox-weakening-options, which reports a sandbox option that the docs say reduces security or removes isolation, such as enableWeakerNestedSandbox, allowAllUnixSockets, a docker.sock entry, allowMachLookup with *, allowAppleEvents, allowNestedUserNamespaces, allowPlaintextInject, or filesystem.disabled while autoAllowBashIfSandboxed is true.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-11T00:00:00Z
---

# claude/sandbox-weakening-options

📝 Do not weaken the sandbox with an option that removes isolation.

⚠️ This rule _warns_ in the following configs: ✅ `recommended`, 🔒 `strict`.

<!-- end auto-generated rule header -->

| Category | Files                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------ |
| security | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule skips a hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

The rule reports each of these in a settings file. A quoted `"true"` counts as `true` in a managed file only.

| Option                                                             | Why the docs call it weaker                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enableWeakerNestedSandbox: true`                                  | The inner sandbox bind-mounts the existing `/proc`, which exposes process information.[^nested] The docs say it considerably weakens security.[^limits]                                                                                                                          |
| `enableWeakerNetworkIsolation: true`                               | It opens a potential data exfiltration path through the macOS trust service.[^network] The rule reports it with or without `network.httpProxyPort`. The docs name the proxy as the reason to use the option, and say to use `excludedCommands` when there is no proxy.[^network] |
| `network.allowAllUnixSockets: true`                                | Sandboxed commands connect to every Unix socket. On WSL2 it also reopens the interop socket.[^allsockets]                                                                                                                                                                        |
| `network.allowUnixSockets` with a `docker.sock` entry              | Access to the Docker socket gives control of the host.[^unix] [^limits] The rule matches an entry whose last path part is `docker.sock`.                                                                                                                                         |
| `network.allowMachLookup` with the entry `"*"`                     | A lone `*` matches every XPC and Mach service.[^mach]                                                                                                                                                                                                                            |
| `allowAppleEvents: true`                                           | It removes code-execution isolation.[^apple]                                                                                                                                                                                                                                     |
| `allowNestedUserNamespaces: true`                                  | It turns off a security boundary. Code from a sandboxed command can then run outside the sandbox.[^userns] [^limits]                                                                                                                                                             |
| `credentials.allowPlaintextInject: true`                           | The credential travels in cleartext on plain HTTP.[^plaintext]                                                                                                                                                                                                                   |
| `filesystem.disabled: true` with `autoAllowBashIfSandboxed` `true` | Commands get unrestricted read and write access, and run with no prompt.[^disable]                                                                                                                                                                                               |

### Scope

- The rule reads one file, except for `autoAllowBashIfSandboxed`. The fault of `filesystem.disabled` needs a file of the
  source that sets it to `true`. A file of the source that sets it to `false` removes the fault. So that part reads the
  source, as `src/permission-source.ts` defines it, and gives no report when it cannot read a file of the source.
- The default of `autoAllowBashIfSandboxed` is `false`. The docs say: "Before v2.1.324, the default was `true`". The
  source is in [`permissions-sandbox-bash-ask`](permissions-sandbox-bash-ask.md#options). With the option `minVersion`
  older than 2.1.324, an unset key counts as `true`.
- Claude Code honors `allowAppleEvents`, `allowNestedUserNamespaces`, `credentials.allowPlaintextInject` and
  `filesystem.disabled` from user and managed settings only. `settings-key-scope` reports each in a project or local file, so this rule does not read them there. In
  practice, `filesystem.disabled` is a managed file check.
- `sandbox-filesystem-disabled-conflict` reports `filesystem.disabled` with `denyRead` or `deny` entries that it switches off.
  This rule reports a different fault on the same value: commands run with no prompt. Both can report it.
- `sandbox-schema` reports a value of the wrong type. This rule reads a Boolean. In a managed file it also reads a quoted
  `"true"` or `"false"`, and counts another value of `autoAllowBashIfSandboxed` as `false`. See
  [`sandbox-schema`](sandbox-schema.md#a-managed-file).

Fail:

```json
{ "sandbox": { "enableWeakerNestedSandbox": true } }
```

Pass:

```json
{ "sandbox": { "enableWeakerNestedSandbox": false } }
```

## Options

<!-- begin auto-generated rule options list -->

| Name         | Description                                                                  | Type   |
| :----------- | :--------------------------------------------------------------------------- | :----- |
| `minVersion` | The oldest Claude Code version that the team supports, as major.minor.patch. | String |

<!-- end auto-generated rule options list -->

```js
'claude/sandbox-weakening-options': ['warn', { minVersion: '2.1.300' }]
```

The option changes only the check of `filesystem.disabled`. Without a `minVersion` older than 2.1.324, that check needs
a file that sets `autoAllowBashIfSandboxed` to `true`. When `minVersion` is older than 2.1.324, the check also reports
an unset key. The value has three numbers, such as `2.1.324`.

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/sandbox-weakening-options': 'warn'
```

## Sources

[^nested]: [All settings: sandbox.enableWeakerNestedSandbox](https://code.claude.com/docs/en/settings-reference#sandbox-enableweakernestedsandbox)
[^network]: [All settings: sandbox.enableWeakerNetworkIsolation](https://code.claude.com/docs/en/settings-reference#sandbox-enableweakernetworkisolation)
[^allsockets]: [All settings: sandbox.network.allowAllUnixSockets](https://code.claude.com/docs/en/settings-reference#sandbox-network-allowallunixsockets)
[^unix]: [All settings: sandbox.network.allowUnixSockets](https://code.claude.com/docs/en/settings-reference#sandbox-network-allowunixsockets)
[^mach]: [All settings: sandbox.network.allowMachLookup](https://code.claude.com/docs/en/settings-reference#sandbox-network-allowmachlookup)
[^apple]: [All settings: sandbox.allowAppleEvents](https://code.claude.com/docs/en/settings-reference#sandbox-allowappleevents)
[^userns]: [All settings: sandbox.allowNestedUserNamespaces](https://code.claude.com/docs/en/settings-reference#sandbox-allownestedusernamespaces)
[^plaintext]: [All settings: sandbox.credentials.allowPlaintextInject](https://code.claude.com/docs/en/settings-reference#sandbox-credentials-allowplaintextinject)
[^disable]: [Configure the sandboxed Bash tool: Disable filesystem isolation](https://code.claude.com/docs/en/sandboxing#disable-filesystem-isolation)
[^limits]: [Configure the sandboxed Bash tool: Security limitations](https://code.claude.com/docs/en/sandboxing#security-limitations)
