---
type: Reference
description: The ESLint rule claude/permissions-additional-directories-path, which reports a permissions.additionalDirectories entry that is a network path (a UNC share or a /net/<host> automount) or that holds a NUL byte, because Claude Code refuses the path or skips the entry.
owner: brianespinosa
created: 2026-10-10
related_issues: [15]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `permissions-additional-directories-path`

Write each `additionalDirectories` entry as a local path.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

The rule also lints the managed settings files: `managed-settings.json` and each `managed-settings.d/*.json` drop-in.
It reads no hidden drop-in, because Claude Code ignores it.

## Rule details

`permissions.additionalDirectories` adds working directories.[^dirs] Claude Code does not add a network path as a
working directory. A lookup of one can contact the host that it names. The refusal covers UNC shares such as
`\\server\share` and automount paths such as `/net/<host>`. At startup, Claude Code warns and starts without the
directory.[^network] Before v2.1.257, Claude Code accepted a reachable network path.[^network]

The rule reads the text of each string entry. It makes two reports:

- **A network path.** The entry starts with `\\` and is not one of the exempt forms below, as in `\\server\share`, or with `/net/` and a host, as in
  `/net/fileserver/home`.
- **A NUL byte.** The changelog of Claude Code says that it skips such an entry that came from an SDK host, an IDE or a hook. It records the fix under 2.1.251. The rule applies the same fault to a settings file. The
  live docs page of the changelog is too large to cite. Read the entry in the
  [changelog file](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md). An entry with a NUL byte gets this
  report only.

The docs say that "mapped drive letters and `\\wsl$` paths don't count as network paths". The rule is silent for
`Z:\share`, `C:\work` and `\\wsl$\Ubuntu\home`. The docs name no other form, so the rule is also silent for
`\\wsl.localhost\...`, the Windows device paths `\\?\...` and `\\.\...`, `//server/share`, `/net` and `/net/`.

The rule reads the text only (ADR 001, Decision 14). It does not test whether a directory exists. It cannot see two
cases of the docs: an automount path is allowed when you start Claude Code from a directory under that host's
automount, and a local path can reach a network location through a symbolic link or a junction.[^network] The first case
depends on the directory where a person starts a session. The second needs a read of the file system.

### One report for one fault

- The type of the key, and the type of each entry, are for [`permissions-schema`](permissions-schema.md). This rule reads
  string entries in an array only.
- The rule does not check that a directory exists, or that it is inside the repository.

The rule reads the last of two keys of one name, as `JSON.parse` does.

Fail:

```json
{ "permissions": { "additionalDirectories": ["\\\\server\\share", "/net/fileserver/home"] } }
```

Pass:

```json
{ "permissions": { "additionalDirectories": ["../docs/", "Z:\\share", "\\\\wsl$\\Ubuntu\\home"] } }
```

## Options

None.

## Sources

[^dirs]: [Configure permissions: Working directories](https://code.claude.com/docs/en/permissions#working-directories)
[^network]: [Error reference: Working directory is a network path](https://code.claude.com/docs/en/errors#working-directory-is-a-network-path)
