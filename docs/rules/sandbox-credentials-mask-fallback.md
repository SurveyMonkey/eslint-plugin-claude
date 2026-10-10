---
type: Reference
description: The ESLint rule claude/sandbox-credentials-mask-fallback, which reports a managed sandbox.credentials mask entry whose extract pattern has no capturing group, or whose file path is a glob pattern or ends in a slash, because Claude Code falls back to deny for such an entry.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `sandbox-credentials-mask-fallback`

Give a `mask` entry an `extract` pattern with a capturing group, and a file path that Claude Code can mask.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | limit | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule reads the `mask` entries of managed files only. It skips a hidden drop-in in `managed-settings.d`, because Claude Code
ignores it.

## Rule details

Claude Code falls back to `"mode": "deny"` for a `mask` entry that it cannot mask safely.[^mask-files] The credential stays
blocked, not masked, until you fix the entry.[^invalid] The rule reports two causes:

- **An `extract` pattern with no capturing group.** The pattern must have at least one capturing group.[^fields] The rule
  reads the `extract` field of a `files` entry and of an `envVars` entry. It counts a group as the regular expression engine of
  Node.js does: `(?:...)`, a look-ahead, a look-behind and a parenthesis in a character class are not groups. A pattern that does
  not compile gets no report.
- **A `path` that is a glob pattern or a directory.** Claude Code falls back to `deny` for a directory path or a glob pattern.[^mask-files]
  The rule reads the text of `path`. It reports a path with `*`, `?` or `[`, and a path that ends in `/`.

### Limits

- The rule does not report a directory path that has no trailing `/`, such as `~/.aws`. The text cannot show it, and the rule
  reads no path from the disk. A credential path resolves to `$HOME` or to an absolute path, outside the repository (ADR 001,
  Decision 14). A file larger than 8 MiB, and a file that is not UTF-8 text, fall back to `deny` too, and the text cannot show them.
- The rule has no threshold option. The row compares no number.
- Before Claude Code v2.1.221, every invalid entry was stripped, and not changed to `deny`.[^invalid] `mask` itself needs v2.1.221.[^fields]
- `sandbox-scope` reports a `mask` entry in a project or local file, where Claude Code drops it. This rule does not read those files.
- `sandbox-credentials-mask` owns the rules between the fields of an entry. `sandbox-schema` owns the type of each field.

Fail, in `managed-settings.json`:

```json
{
  "sandbox": {
    "credentials": {
      "files": [{ "path": "~/.config/gh/hosts.yml", "mode": "mask", "extract": "oauth_token:\\s*\\S+" }]
    }
  }
}
```

Pass, in `managed-settings.json`:

```json
{
  "sandbox": {
    "credentials": {
      "files": [{ "path": "~/.config/gh/hosts.yml", "mode": "mask", "extract": "oauth_token:\\s*(\\S+)" }]
    }
  }
}
```

## Options

None. The rule has no threshold option.

## Sources

[^fields]: [All settings: Mask fields for files](https://code.claude.com/docs/en/settings-reference#mask-fields-for-files)
[^invalid]: [All settings: Invalid credential entries in managed settings](https://code.claude.com/docs/en/settings-reference#invalid-credential-entries-in-managed-settings)
[^mask-files]: [Configure the sandboxed Bash tool: Mask credential files](https://code.claude.com/docs/en/sandboxing#mask-credential-files)
