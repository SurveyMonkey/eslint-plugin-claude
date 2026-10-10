---
type: Reference
description: The ESLint rule claude/sandbox-credentials-aws, which reports awsPairs entries that do not name whole-value mask variables, a variable in two slots, a lone masked AWS key, and a mask file with onExtractNoMatch deny that Claude Code acts on as error.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `sandbox-credentials-aws`

Give the AWS entries of `sandbox.credentials` the form that Claude Code can pair and apply.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule lints the managed settings files only. It skips a hidden drop-in, because Claude Code ignores it.

## Rule details

Claude Code honors `awsPairs` and `mask` entries in user settings, managed settings and the `--settings` flag only.[^pairs]
[`settings-key-scope`](settings-key-scope.md) reports `awsPairs` in a project file, and [`sandbox-scope`](sandbox-scope.md)
reports a `mask` entry there. So the rule reads the managed files. The rule adds up the files of one managed source:
`managed-settings.json` with the files of `managed-settings.d/`. A file that the rule cannot read adds nothing to what a value proves. The rule makes no `awsPairs` report and no lone-key report when it cannot read a file of the source. It also ignores `filesystem.disabled` then, because that file can set it to `false`.

### awsPairs

Each variable that a pair names must be a whole-value `mask` entry in `sandbox.credentials.envVars`, with no `extract` or
`decode`. A variable can fill one slot across all pairs.[^pairs] The rule reports on the name in the pair:

- The source holds an entry for the name and none is a whole-value `mask` entry. Or the source also holds a `deny` entry for it.
  Claude Code applies `deny` when a variable has both modes.[^envvars]
- The name is in a slot already, in the same pair or an earlier one.

A name with no entry in the source gets no report, because a user file can hold the entry. `awsPairs` is taken whole from
the highest source that sets it.[^pairs] When a second file of the managed source also sets it, the rule makes no `awsPairs` report and no lone-key report. It cannot tell which value Claude Code uses.

### The access key and the secret key

The proxy detects a SigV4 request by the sentinel of the access key. It then re-signs the request with the real values. If only the secret
is masked, Claude Code signs the requests with a placeholder that the proxy cannot detect. They fail at AWS.[^resign]
Claude Code links `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `AWS_SESSION_TOKEN` when their whole values are masked.[^resign]
The rule reports a `mask` entry for the access key or the secret key when the source holds no `mask` entry for the other. The rule
makes no report when a pair names a conventional variable, because the pair replaces the automatic link.[^pairs]

### onExtractNoMatch deny

Take a `mask` entry of `credentials.files` with `onExtractNoMatch: "deny"`. Claude Code acts as if the value is `error` when it does not enforce the
read block. This happens when filesystem isolation is off, or when a `sandbox.filesystem.allowRead` entry
re-opens the path.[^files-fields] Sandbox setup then stops when the pattern matches nothing.[^mask-files] The rule reports the
value of `onExtractNoMatch` in two cases. In the first, `filesystem.disabled` is `true` in a file of the source and no readable file sets it to `false`. In the second, an `allowRead` entry equals the
path or is a directory above it. The rule compares the text of the paths after it removes a final `/` or `/**`. It does not
resolve `~`, a link or a glob. The rule does not check the platform.

On macOS with filesystem isolation on, Claude Code applies a `mask` entry as `deny` before the pattern runs. The report can then have no effect there.

### Not checked

`sigv4` is for `sandbox-schema`. The rule does not check that `extract` or `decode` is set. It makes no report for a file entry that has neither, because no pattern runs then.

Fail, in `managed-settings.json`:

```json
{
  "sandbox": {
    "network": { "tlsTerminate": {} },
    "credentials": {
      "envVars": [{ "name": "AWS_SECRET_ACCESS_KEY", "mode": "mask" }]
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
      "envVars": [
        { "name": "AWS_ACCESS_KEY_ID", "mode": "mask" },
        { "name": "AWS_SECRET_ACCESS_KEY", "mode": "mask" }
      ]
    }
  }
}
```

## Options

None.

## Sources

[^pairs]: [All settings: sandbox.credentials.awsPairs](https://code.claude.com/docs/en/settings-reference#sandbox-credentials-awspairs)
[^envvars]: [All settings: sandbox.credentials.envVars](https://code.claude.com/docs/en/settings-reference#sandbox-credentials-envvars)
[^files-fields]: [All settings: Mask fields for files](https://code.claude.com/docs/en/settings-reference#mask-fields-for-files)
[^resign]: [Configure the sandboxed Bash tool: Re-sign AWS requests](https://code.claude.com/docs/en/sandboxing#re-sign-aws-requests)
[^mask-files]: [Configure the sandboxed Bash tool: Mask credential files](https://code.claude.com/docs/en/sandboxing#mask-credential-files)
