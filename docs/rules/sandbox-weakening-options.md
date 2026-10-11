---
type: Reference
description: The ESLint rule claude/sandbox-weakening-options, which reports a sandbox option that the docs say reduces security or removes isolation, such as enableWeakerNestedSandbox, allowAllUnixSockets, a docker.sock entry, allowMachLookup with *, allowAppleEvents, allowPlaintextInject, or filesystem.disabled while autoAllowBashIfSandboxed is not false.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `sandbox-weakening-options`

Do not weaken the sandbox with an option that removes isolation.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | security | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule skips a hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

The rule reports each of these in a settings file. A quoted `"true"` counts as `true` in a managed file only.

| Option | Why the docs call it weaker |
|--------|-----------------------------|
| `enableWeakerNestedSandbox: true` | The inner sandbox bind-mounts the existing `/proc`, which exposes process information.[^nested] The docs say it considerably weakens security.[^limits] |
| `enableWeakerNetworkIsolation: true` | It opens a potential data exfiltration path through the macOS trust service.[^network] The rule reports it with or without `network.httpProxyPort`. The docs name the proxy as the reason to use the option, and say to use `excludedCommands` when there is no proxy.[^network] |
| `network.allowAllUnixSockets: true` | Sandboxed commands connect to every Unix socket. On WSL2 it also reopens the interop socket.[^allsockets] |
| `network.allowUnixSockets` with a `docker.sock` entry | Access to the Docker socket gives control of the host.[^unix] [^limits] The rule matches an entry whose last path part is `docker.sock`. |
| `network.allowMachLookup` with the entry `"*"` | A lone `*` matches every XPC and Mach service.[^mach] |
| `allowAppleEvents: true` | It removes code-execution isolation.[^apple] |
| `credentials.allowPlaintextInject: true` | The credential travels in cleartext on plain HTTP.[^plaintext] |
| `filesystem.disabled: true` with `autoAllowBashIfSandboxed` not `false` | Commands get unrestricted read and write access, and run with no prompt.[^disable] |

### Scope

- The rule reads one file, except for `autoAllowBashIfSandboxed`. A file of the source that sets it to `false` removes the
  fault of `filesystem.disabled`. So that part reads the source, as `src/permission-source.ts` defines it, and gives no report
  when it cannot read a file of the source.
- Claude Code honors `allowAppleEvents`, `credentials.allowPlaintextInject` and `filesystem.disabled` from user and managed
  settings only. `settings-key-scope` reports each in a project or local file, so this rule does not read them there. In
  practice, `filesystem.disabled` is a managed file check.
- `sandbox-filesystem-disabled-conflict` reports `filesystem.disabled` with `denyRead` or `deny` entries that it switches off.
  This rule reports a different fault on the same value: commands run with no prompt. Both can report it.
- `sandbox-schema` reports a value of the wrong type. This rule reads a Boolean `true` only.

Fail:

```json
{ "sandbox": { "enableWeakerNestedSandbox": true } }
```

Pass:

```json
{ "sandbox": { "enableWeakerNestedSandbox": false } }
```

## Options

None.

## Sources

[^nested]: [All settings: sandbox.enableWeakerNestedSandbox](https://code.claude.com/docs/en/settings-reference#sandbox-enableweakernestedsandbox)
[^network]: [All settings: sandbox.enableWeakerNetworkIsolation](https://code.claude.com/docs/en/settings-reference#sandbox-enableweakernetworkisolation)
[^allsockets]: [All settings: sandbox.network.allowAllUnixSockets](https://code.claude.com/docs/en/settings-reference#sandbox-network-allowallunixsockets)
[^unix]: [All settings: sandbox.network.allowUnixSockets](https://code.claude.com/docs/en/settings-reference#sandbox-network-allowunixsockets)
[^mach]: [All settings: sandbox.network.allowMachLookup](https://code.claude.com/docs/en/settings-reference#sandbox-network-allowmachlookup)
[^apple]: [All settings: sandbox.allowAppleEvents](https://code.claude.com/docs/en/settings-reference#sandbox-allowappleevents)
[^plaintext]: [All settings: sandbox.credentials.allowPlaintextInject](https://code.claude.com/docs/en/settings-reference#sandbox-credentials-allowplaintextinject)
[^disable]: [Configure the sandboxed Bash tool: Disable filesystem isolation](https://code.claude.com/docs/en/sandboxing#disable-filesystem-isolation)
[^limits]: [Configure the sandboxed Bash tool: Security limitations](https://code.claude.com/docs/en/sandboxing#security-limitations)
