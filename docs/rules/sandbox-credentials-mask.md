---
type: Reference
description: The ESLint rule claude/sandbox-credentials-mask, which reports a sandbox.credentials mask entry in a managed source whose fields disagree or lack what a mask entry needs, and a deny entry that holds mask fields.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `sandbox-credentials-mask`

Give each `mask` entry of `sandbox.credentials` fields that agree with each other and with the sandbox settings.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule skips a hidden drop-in in `managed-settings.d`, because Claude Code ignores it.

## Rule details

The rule checks the rules between the fields of an entry. [`sandbox-schema`](sandbox-schema.md) checks the type of each field.

### Mask entries

Claude Code honors a `mask` entry only in user settings, managed settings and the `--settings` flag. It drops the entry in
`.claude/settings.json` and `.claude/settings.local.json`.[^files-scope] [`sandbox-scope`](sandbox-scope.md) reports it there. So the rule
reads the `mask` entries of a managed source only. The rule reports each case on the field that is wrong. When the whole entry is wrong, it reports on the `mode` value:

- **No TLS termination.** The source holds neither `network.tlsTerminate` nor `credentials.allowPlaintextInject: true`.
  Substitution runs only through the proxy. Without TLS termination, the placeholder reaches the server and authentication
  fails.[^files][^mask]
- **`maskClaims` without `decode`.** The field needs `"decode": "jwt"`, and needs at least one claim name.[^mask-files][^mask-env]
- **`maskDuplicates` without `extract` or `decode`.** Claude Code reads the field only when `extract` or `decode` is set. It is a
  field of a file entry.[^mask-files]
- **`extract` with `decode` in an environment variable entry.** The two cannot be combined there.[^mask-env] A file entry accepts both.
- **`onExtractNoMatch` other than `warn` with `decode` in an environment variable entry.** Only `warn` is accepted.[^mask-env]
- **An `injectHosts` entry that can never match.** Write an IPv6 destination as the bare compressed address, as `::1`.
  The proxy matches the bare destination address, so a bracketed address and an address with a zone ID never match.[^ipv6]
- **A `mask` entry for a variable with a `deny` entry.** Claude Code applies `deny` when the same variable has both modes.[^envvars]

### Deny entries

Claude Code accepts the mask fields on a `deny` entry and ignores them.[^files][^envvars] The rule reports the entry once, on the
value of `mode`, and names the fields. This check applies to every file kind, because a project file keeps a `deny` entry.

### Limits

- `injectHosts` is not compared with `allowedDomains`. The list of allowed hosts also holds `WebFetch` allow rules, the approvals of a
  session and the lists of the user file. A repository file cannot show it.[^mask]
- The rule reads the `tlsTerminate` and `allowPlaintextInject` of the managed files of the repository. A user file or the `--settings`
  flag can set them. A quoted `"true"` in `allowPlaintextInject` does not count. A `tlsTerminate` value that is not an object does not count.
- The rule reads a variable `name` for the match with a `deny` entry. It does not read a `deny` entry for a file path.
- A `mask` entry that Claude Code degrades to `deny` is for `sandbox-credentials-mask-fallback`.

The rule adds up the files of one managed source: `managed-settings.json` with the files of `managed-settings.d/`. A file that the rule
cannot read adds nothing to what a value proves. The check for `tlsTerminate` and `allowPlaintextInject` rests on an absence. So the rule makes no TLS report when it cannot read a file of the source. The rule never reads a project file for a managed file.

Fail, in `managed-settings.json`:

```json
{
  "sandbox": {
    "credentials": {
      "envVars": [{ "name": "SERVICE_JWT", "mode": "mask", "maskClaims": ["api_key"] }]
    }
  }
}
```

Pass, in `managed-settings.json`:

```json
{
  "sandbox": {
    "network": { "tlsTerminate": {} },
    "credentials": {
      "envVars": [{ "name": "SERVICE_JWT", "mode": "mask", "decode": "jwt", "maskClaims": ["api_key"] }]
    }
  }
}
```

## Options

None.

## Sources

[^files]: [All settings: sandbox.credentials.files](https://code.claude.com/docs/en/settings-reference#sandbox-credentials-files)
[^envvars]: [All settings: sandbox.credentials.envVars](https://code.claude.com/docs/en/settings-reference#sandbox-credentials-envvars)
[^files-scope]: [All settings: sandbox.credentials](https://code.claude.com/docs/en/settings-reference#sandbox-credentials)
[^mask-files]: [All settings: Mask fields for files](https://code.claude.com/docs/en/settings-reference#mask-fields-for-files)
[^mask-env]: [All settings: Mask fields for environment variables](https://code.claude.com/docs/en/settings-reference#mask-fields-for-environment-variables)
[^mask]: [Configure the sandboxed Bash tool: Mask credentials](https://code.claude.com/docs/en/sandboxing#mask-credentials)
[^ipv6]: [Configure the sandboxed Bash tool: Mask environment variables](https://code.claude.com/docs/en/sandboxing#mask-environment-variables)
