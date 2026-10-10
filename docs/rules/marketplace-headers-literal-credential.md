---
type: Reference
description: The ESLint rule claude/marketplace-headers-literal-credential, which reports a literal credential, such as Bearer followed by a token, in the headers of a marketplace.json entry or of a url source in a project settings file.
owner: brianespinosa
created: 2026-10-10
related_issues: [12]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `marketplace-headers-literal-credential`

Keep a literal credential out of the headers of a marketplace download.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | security | `**/.claude-plugin/marketplace.json`, `**/.claude/settings.json`, `**/.claude/settings.local.json` |

## Rule details

The `headers` of a marketplace entry hold HTTP headers. Claude Code sends them when it downloads
the archive of that entry.[^auth] The `headers` of a `url` marketplace source go with archive
downloads from the origin of the marketplace URL.[^auth][^types] Both are for authenticated hosts. Anyone who can
read a committed file can read a literal credential in it. A gitignored `settings.local.json` is
open to fewer people, but the rule still reads it.

The docs do not bar a literal header. This rule is a security practice check, and it is `off` in
`recommended`. For a value that expires, the docs say to set a `headersHelper` command
instead.[^auth][^types] The docs show the form `Bearer ${TOKEN}` in an example of a `url`
source.[^allowed] They do not say that Claude Code expands such a reference. The rule takes it
as no literal, as the inventory row does. A scheme and a token that stay after the
references go make a literal, as in `Bearer abc123${SUFFIX}`. Punctuation alone is no token, as in
`Bearer ${A}.${B}`.

The rule reads two places:

- **An entry of `marketplace.json`.** It reads the `headers` object of each entry in `plugins`.
- **A `url` source in a project settings file.** It reads the `headers` object of each
  `extraKnownMarketplaces` entry whose `source.source` is `url`, in `.claude/settings.json` and
  `.claude/settings.local.json`.

The rule reports the value of a header when all of these hold:

- The value is a string. It has no `${NAME}` reference, or a scheme and a token stay without them.
- The value is not empty, and is not only a scheme word such as `Bearer`.
- The value is a scheme and a token (`Bearer`, `Basic`, `Token` or `Digest`). Or the header name
  holds `auth`, `token`, `secret`, `key`, `passw` or `cred`. Letter case does not matter for the
  scheme or the name.

The name match is a substring match. A name such as `X-Author` can match. A name outside the list,
such as `X-Api-Sig`, passes unless its value is a scheme and a token.

The message names the header. It never gives the value.

The rule does not read the `headers` of an inline plugin entry in a `settings` source. It does not
read a file that is not a project settings file. A `headers` value that is not an object is a
fault for [`marketplace-schema`](marketplace-schema.md) and
[`settings-extra-known-marketplaces-schema`](settings-extra-known-marketplaces-schema.md). No rule
reports a header value that is not a string, and this rule skips it.

When a key appears twice, the rule reads the last, as `JSON.parse` does.

Fail:

```json
{
  "name": "acme",
  "owner": { "name": "Acme" },
  "plugins": [
    {
      "name": "formatter",
      "source": { "source": "archive", "url": "https://registry.example.com/formatter.zip" },
      "headers": { "Authorization": "Bearer eyJhbGciOiJSUzI1NiJ9" }
    }
  ]
}
```

Pass:

```json
{
  "name": "acme",
  "owner": { "name": "Acme" },
  "plugins": [
    {
      "name": "formatter",
      "source": { "source": "archive", "url": "https://registry.example.com/formatter.zip" },
      "headersHelper": "/opt/bin/mint-registry-token.sh"
    }
  ]
}
```

## Options

None.

## Sources

[^auth]: [Host and maintain a marketplace: Authenticate archive downloads](https://code.claude.com/docs/en/plugins/host-marketplace#authenticate-archive-downloads)
[^types]: [All settings: Marketplace source types](https://code.claude.com/docs/en/settings-reference#marketplace-source-types)
[^allowed]: [All settings: Allowed source types](https://code.claude.com/docs/en/settings-reference#allowed-source-types)
