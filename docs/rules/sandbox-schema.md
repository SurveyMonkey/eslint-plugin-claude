---
type: Reference
description: The ESLint rule claude/sandbox-schema, which reports a key in sandbox, sandbox.filesystem, sandbox.network or sandbox.credentials that Claude Code does not read, and a value of the wrong type, such as a port outside 1 to 65535, a relative bwrapPath, a credentials entry with no mode, or a mask field that is not valid.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `sandbox-schema`

Use only the documented keys in `sandbox`, each with a value of its type.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

The rule owns every key under `sandbox`, so `settings-schema` makes no report inside it. The names of the keys are in
`src/data/settings-keys.ts`, with the scope of each. The types are in `src/data/sandbox-keys.ts`.

`sandbox` has 12 keys, and the objects `filesystem`, `network` and `credentials`.[^sandbox] The rule reports a key that is not
in the list at these four levels. The report is on the key, and the message gives the dotted name.

| Level | Keys and types |
|-------|----------------|
| `sandbox` | Booleans: `enabled`, `failIfUnavailable`, `autoAllowBashIfSandboxed`, `allowUnsandboxedCommands`, `enableWeakerNestedSandbox`, `enableWeakerNetworkIsolation`, `allowAppleEvents`. `excludedCommands`: array of strings. `bwrapPath`, `socatPath`: absolute path.[^bwrap][^socat] `ignoreViolations`: object that maps a string to an array of strings.[^ignore] `ripgrep`: object with `command` (required) and `args`.[^ripgrep] |
| `sandbox.filesystem` | Arrays of strings: `allowWrite`, `denyWrite`, `denyRead`, `allowRead`. Booleans: `allowManagedReadPathsOnly`, `disabled`.[^filesystem] |
| `sandbox.network` | Arrays of strings: `allowUnixSockets`, `allowedDomains`, `deniedDomains`. `allowMachLookup`: array of strings with a `*` only at the end.[^mach] Booleans: `allowAllUnixSockets`, `allowLocalBinding`, `strictAllowlist`, `allowManagedDomainsOnly`. `httpProxyPort`, `socksProxyPort`: a TCP port.[^network] `tlsTerminate`: object with `caCertPath` and `caKeyPath` strings.[^tls] |
| `sandbox.credentials` | `files`: array of objects with `path` and `mode`.[^files] `envVars`: array of objects with `name` and `mode`. `allowPlaintextInject`: Boolean.[^plaintext] `awsPairs`: array of objects with `accessKeyIdVar` and `secretAccessKeyVar`, and an optional `sessionTokenVar`.[^aws] `sigv4`: object with `streaming`, `presigned` and `sigv4a`, each `"deny"` or `"passthrough"`.[^sigv4] |

The rule reports these faults, each once for a value:

- **A value of the wrong type**, such as a string where the docs name a Boolean, or an entry that is not a string.
- **A port that is not a whole number from 1 to 65535.** The docs say "a local TCP port" and state no range. The range is the
  range of a TCP port.
- **A `bwrapPath` or `socatPath` that is not an absolute path.** Claude Code drops a relative path and finds the binary on `PATH`.
  The rule reads a path as absolute when it starts with `/`. Both keys are for Linux and WSL2.[^bwrap][^socat]
- **An `allowMachLookup` entry with a `*` that does not end the name,** or with two `*`. A single trailing `*` matches a prefix,
  and `"*"` alone matches every service.
- **A credentials entry** that lacks `path` (files), `name` (variables) or `mode`, or has a `mode` other than `"deny"` or
  `"mask"`, an `onExtractNoMatch` other than `"warn"`, `"deny"` or `"error"`, or a `decode` other than `"jwt"`.[^maskfiles][^maskenv] A
  variable `name` must start with a letter or an underscore, and hold letters, digits and underscores only.[^envvars]
  An `awsPairs` entry lacks `accessKeyIdVar` or `secretAccessKeyVar`.

### A managed file

Claude Code validates each field of a managed `sandbox` block on its own and does not drop the block. A quoted `"true"` or
`"false"` counts as that Boolean, so the rule does not report it in a managed file. It reports it in a project or local file, for a key
that Claude Code reads there.
While `network.deniedDomains`, `filesystem.denyRead` or `filesystem.denyWrite`, or an entry of one, is invalid, Claude Code
withholds the allow lists that go with it, and the message says so. `deniedDomains` goes with `allowedDomains`. `denyRead` and `denyWrite` go with `allowRead` and `allowWrite`. The per-field repair needs Claude Code v2.1.283 or later.[^managed]

### One report for one fault

- The scope of a key is for [`settings-key-scope`](settings-key-scope.md). It reports `sandbox.bwrapPath` in a project file. The
  rule makes no report on the value of such a key there, or on a key below it. A key that is not in the list still gets a report.
- The text of a domain is for [`sandbox-domain-syntax`](sandbox-domain-syntax.md), and the text of an `excludedCommands` entry is
  for [`sandbox-excluded-commands-syntax`](sandbox-excluded-commands-syntax.md). The rule checks the type only.
- A `mask` entry in a project file is for [`sandbox-scope`](sandbox-scope.md).
- The rule does not check a regular expression in `extract`, the fields that a `mask` entry needs, or the keys inside an object
  value (`ripgrep`, `tlsTerminate`, `sigv4`, an entry). Those cases are for other rules of the inventory, such as `sandbox-credentials-mask`.
- A `permissions` key is for [`permissions-schema`](permissions-schema.md).

A `null` removes a key, so the rule takes it as no key. A required field that is `null` is missing. The rule reads the last of two
keys of one name, as `JSON.parse` does. A hidden file in `managed-settings.d/` gets no report, because Claude Code ignores it.

Fail, in `managed-settings.json`:

```json
{
  "sandbox": {
    "enabeld": true,
    "bwrapPath": "bwrap",
    "network": {
      "httpProxyPort": 70000,
      "allowMachLookup": ["*.apple"]
    },
    "credentials": { "envVars": [{ "name": "1TOKEN", "mode": "allow" }] }
  }
}
```

Pass:

```json
{
  "sandbox": {
    "enabled": true,
    "bwrapPath": "/opt/admin/bwrap",
    "network": {
      "httpProxyPort": 8080,
      "allowMachLookup": ["com.apple.coresimulator.*"]
    },
    "credentials": { "envVars": [{ "name": "NPM_TOKEN", "mode": "deny" }] }
  }
}
```

## Options

None.

## Sources

[^sandbox]: [All settings: sandbox](https://code.claude.com/docs/en/settings-reference#sandbox)
[^filesystem]: [All settings: sandbox.filesystem](https://code.claude.com/docs/en/settings-reference#sandbox-filesystem)
[^network]: [All settings: sandbox.network](https://code.claude.com/docs/en/settings-reference#sandbox-network)
[^ignore]: [All settings: sandbox.ignoreViolations](https://code.claude.com/docs/en/settings-reference#sandbox-ignoreviolations)
[^bwrap]: [All settings: sandbox.bwrapPath](https://code.claude.com/docs/en/settings-reference#sandbox-bwrappath)
[^mach]: [All settings: sandbox.network.allowMachLookup](https://code.claude.com/docs/en/settings-reference#sandbox-network-allowmachlookup)
[^socat]: [All settings: sandbox.socatPath](https://code.claude.com/docs/en/settings-reference#sandbox-socatpath)
[^ripgrep]: [All settings: sandbox.ripgrep](https://code.claude.com/docs/en/settings-reference#sandbox-ripgrep)
[^tls]: [All settings: sandbox.network.tlsTerminate](https://code.claude.com/docs/en/settings-reference#sandbox-network-tlsterminate)
[^files]: [All settings: sandbox.credentials.files](https://code.claude.com/docs/en/settings-reference#sandbox-credentials-files)
[^plaintext]: [All settings: sandbox.credentials.allowPlaintextInject](https://code.claude.com/docs/en/settings-reference#sandbox-credentials-allowplaintextinject)
[^aws]: [All settings: sandbox.credentials.awsPairs](https://code.claude.com/docs/en/settings-reference#sandbox-credentials-awspairs)
[^envvars]: [All settings: sandbox.credentials.envVars](https://code.claude.com/docs/en/settings-reference#sandbox-credentials-envvars)
[^sigv4]: [All settings: sandbox.credentials.sigv4](https://code.claude.com/docs/en/settings-reference#sandbox-credentials-sigv4)
[^maskfiles]: [All settings: Mask fields for files](https://code.claude.com/docs/en/settings-reference#mask-fields-for-files)
[^maskenv]: [All settings: Mask fields for environment variables](https://code.claude.com/docs/en/settings-reference#mask-fields-for-environment-variables)
[^managed]: [Deploy managed settings: Invalid values inside sandbox](https://code.claude.com/docs/en/managed-settings#invalid-values-inside-sandbox)
