---
type: Reference
description: The ESLint rule claude/marketplace-headers-helper-command, which reports a headersHelper command in a marketplace.json entry that is not printable ASCII, is longer than 500 characters, has a run of four spaces, or starts with a relative path, with the max option.
owner: brianespinosa
created: 2026-10-06
related_issues: [12]
stale_after: 2027-04-06
generated:
  by: claude-code
  at: 2026-10-06T00:00:00Z
---

# `marketplace-headers-helper-command`

Write the `headersHelper` command of an entry as the docs require.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude-plugin/marketplace.json` |

## Rule details

An entry can set `headersHelper`. It is a command that prints the headers for the download of the
archive of that entry.[^entry] The docs give these requirements for the command text.[^write] The
rule reports each one that a string `headersHelper` does not meet:

- **Printable ASCII.** The command has a character outside the range from space to `~`.
- **Length.** The command has more than 500 characters. Use the `max` option to set another limit.
- **Spaces.** The command has a run of four or more spaces.
- **Relative path.** The first word starts with `./` or `../`. Claude Code runs the command in its
  configuration directory, `~/.claude` or `CLAUDE_CONFIG_DIR`. A relative path resolves against
  that directory, not against the project. Use an absolute path, or a command on `PATH`.[^write]

Each failed requirement is a separate report on the string. The rule counts characters as
JavaScript does (`String.length`, UTF-16 code units). It reads the first word as the text up to
the first white space, after any leading white space. The docs name a relative path. The rule
checks the `./` and `../` forms only. A command such as `bin/mint` has no report.

The docs give the same text requirements for a `headersHelper` on the `url` source of a marketplace.
That source is a marketplace source, in settings.[^fields] A plugin source of type `url` has the fields
`url`, `ref` and `sha`, and no `headersHelper`.[^sources] So the rule reads the `headersHelper` of
an entry, and no source object in `marketplace.json`.

The rule reads each object in `plugins`. When an entry has two `headersHelper` keys, the rule reads
the last, as `JSON.parse` does. A `headersHelper` that is not a string is a fault for
`marketplace-schema`. The rule does not check it.

The docs list no `claude plugin validate` message for the text of the command.[^validation]
Validate reports a `headersHelper` on an `archive` entry that is not `"strict": false`, and warns
that it has no effect on an entry with another source type. The rule checks neither.

Fail:

```json
{
  "name": "acme",
  "plugins": [
    {
      "name": "formatter",
      "strict": false,
      "source": { "source": "archive", "url": "https://example.com/formatter.zip" },
      "headersHelper": "./mint-token"
    }
  ]
}
```

Pass:

```json
{
  "name": "acme",
  "plugins": [
    {
      "name": "formatter",
      "strict": false,
      "source": { "source": "archive", "url": "https://example.com/formatter.zip" },
      "headersHelper": "/usr/local/bin/mint-token"
    }
  ]
}
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `max` | `500` | The most characters in the command. An integer from 1 to 500. Optional. |

```js
'claude/marketplace-headers-helper-command': ['error', { max: 200 }]
```

The default is the limit in the docs.[^write] The schema sets 500 as the maximum, because no
Claude Code setting moves that limit. A team can set a lower value. A config that sets only the
severity keeps the default. The `recommended` and `strict` configs set no option.

At the default, the message says that the docs allow at most 500. At another value, the message
says "The configured limit is 200", and it does not say what the docs allow.

## Sources

[^entry]: [Marketplace reference: Plugin entries](https://code.claude.com/docs/en/plugins/marketplace-reference#plugin-entries)
[^write]: [Host and maintain a marketplace: Write the headersHelper command](https://code.claude.com/docs/en/plugins/host-marketplace#write-the-headershelper-command)
[^fields]: [Marketplace reference: Fields by type](https://code.claude.com/docs/en/plugins/marketplace-reference#fields-by-type)
[^sources]: [Marketplace reference: Plugin sources](https://code.claude.com/docs/en/plugins/marketplace-reference#plugin-sources)
[^validation]: [Marketplace reference: Validation messages](https://code.claude.com/docs/en/plugins/marketplace-reference#validation-messages)
