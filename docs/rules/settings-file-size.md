---
type: Reference
description: The ESLint rule claude/settings-file-size, which reports a settings file of more than 2 MiB (2097152 bytes), the size at which Claude Code refuses a --settings file, with the max option.
owner: brianespinosa
created: 2026-10-08
related_issues: [14]
stale_after: 2027-04-08
generated:
  by: claude-code
  at: 2026-10-08T00:00:00Z
---

# `settings-file-size`

Keep a settings file at or under 2 MiB.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | limit | `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

Claude Code exits with code 1 at startup when a file that you pass with `--settings` is larger than
2 MiB.[^error] The CLI reference says the same: the file must be a regular file of at most
2 MiB.[^flag]

The docs state this limit for a `--settings` file. The rule applies the number to each settings
file of the repository, because a script can pass any of them with `--settings`.

The rule counts the UTF-8 bytes of the file text. It reports a file of more than `max` bytes, once,
at the start of the file. A file of exactly 2097152 bytes passes.

ESLint removes a byte order mark before the rule runs, so the rule does not count its 3 bytes. A file
that is within 3 bytes of the limit can pass the rule and still be too large.

A file that is not valid JSON gets a fatal parse error from the `json/json` language, and no rule
runs on it. So a file with a syntax error gets no size report.

The rule does not check that the path is a regular file. The same error page lists a device, a
FIFO and a socket as refused paths.[^error] A file in a repository is a regular file in nearly every
case.

Fail, with the option `{ max: 100 }`, for a file of 101 bytes or more:

```json
{
  "env": { "NOTE": "a long text that makes this file larger than the configured limit of 100 bytes" }
}
```

Pass, in the same configuration:

```json
{
  "model": "opus"
}
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `max` | `2097152` | The most bytes of the file. An integer from 1 to 2097152. Optional. |

```js
'claude/settings-file-size': ['error', { max: 1048576 }]
```

The default is the limit in the docs.[^error] The schema sets 2097152 as the maximum, because no
Claude Code setting moves that limit. A team can set a lower value. A config that sets only the
severity keeps the default. The `recommended` and `strict` configs set no option.

At the default, the message says that Claude Code refuses a `--settings` file of more than 2097152
bytes. At another value, the message says "The configured limit is 1048576 bytes", and it does not
say what the docs allow.

## Sources

[^error]: [Error reference: Settings file exceeds the 2MiB limit](https://code.claude.com/docs/en/errors#settings-file-exceeds-the-2mib-limit)
[^flag]: [CLI reference: CLI flags](https://code.claude.com/docs/en/cli-reference#cli-flags)
