---
type: Reference
description: The ESLint rule claude/settings-marketplace-headers-helper-https, which reports a url marketplace source in an extraKnownMarketplaces entry that sets a headersHelper and has a url that does not start with https://, because Claude Code does not run the command.
owner: brianespinosa
created: 2026-10-08
related_issues: [12]
stale_after: 2027-04-08
generated:
  by: claude-code
  at: 2026-10-08T00:00:00Z
---

# `settings-marketplace-headers-helper-https`

Give a `url` marketplace source that has a `headersHelper` an `https://` URL.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude/settings.json`, `**/.claude/settings.local.json` |

## Rule details

A `url` source in `extraKnownMarketplaces` can set `headersHelper`. It is a command that prints
HTTP headers for the fetch of the `marketplace.json` file.[^source] Claude Code runs the command
only for an `https://` marketplace URL. For another URL, the command does not run, and requests
carry only the headers in the `headers` field.[^skips] So the command is dead text, and Claude
Code gives no error.

The rule reports the `url` value of a source that meets all of these conditions:

- The source type is `url`.
- The source sets `headersHelper`. The rule counts the key as set for any value, also an empty
  string. The docs do not say that an empty value changes the rule.
- The `url` is a string that does not start with `https://`. The rule ignores letter case in the
  scheme, because a URL scheme is not case sensitive. The empty string gives a report.

The rule reports the `url` and not the `headersHelper`. A fix is a change of the URL.

When a file has two members with one marketplace name, the rule reads the last, as `JSON.parse`
does. It does the same for the keys of a source.

Other rules own other faults. A `url` that is missing or is not a string gives no report here.
`settings-extra-known-marketplaces-schema` reports it. The rule does not check the text of the
command. It does not read the `headersHelper` of an item in the `plugins` of a `settings` source. That
command runs for an archive download and not for this URL. The rule does not
read the alias `additionalMarketplaces`.

Fail:

```json
{
  "extraKnownMarketplaces": {
    "acme": {
      "source": {
        "source": "url",
        "url": "http://plugins.example.com/marketplace.json",
        "headersHelper": "/opt/bin/mint-token"
      }
    }
  }
}
```

Pass:

```json
{
  "extraKnownMarketplaces": {
    "acme": {
      "source": {
        "source": "url",
        "url": "https://plugins.example.com/marketplace.json",
        "headersHelper": "/opt/bin/mint-token"
      }
    }
  }
}
```

## Sources

[^source]: [All settings: Marketplace source types](https://code.claude.com/docs/en/settings-reference#marketplace-source-types)
[^skips]: [Host and maintain a marketplace: When Claude Code skips a headersHelper command or drops its output](https://code.claude.com/docs/en/plugins/host-marketplace#when-claude-code-skips-a-headershelper-command-or-drops-its-output)
