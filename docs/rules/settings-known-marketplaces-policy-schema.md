---
type: Reference
description: The ESLint rule claude/settings-known-marketplaces-policy-schema, which reports a strictKnownMarketplaces, allowedMarketplaces or blockedMarketplaces entry in a managed settings file that is not a source object of a known type, and a pluginTrustMessage that is not a string.
owner: brianespinosa
created: 2026-10-09
related_issues: [12]
stale_after: 2027-04-09
generated:
  by: claude-code
  at: 2026-10-09T00:00:00Z
---

# `settings-known-marketplaces-policy-schema`

Write each marketplace policy entry as a source object that Claude Code reads.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

`strictKnownMarketplaces` is an array of marketplace source objects.[^strict] It is the allowlist.
`blockedMarketplaces` is the blocklist, and it takes the same forms.[^blocked] The rule reads both
keys in each managed settings file. It also reads the alias `allowedMarketplaces`.[^aliases]
When a file sets both spellings, Claude Code uses the canonical key and ignores the alias. So the
rule reads the alias only when the canonical key is not there.

The rule reports each of these faults:

- **Entry.** An entry is not an object.
- **Source type.** The `source` type is missing, is not a string, or is not a known type. The known
  types are `github`, `git`, `url`, `file`, `directory`, `settings`, `hostPattern`, `pathPattern`
  and `skills-dir`.[^types][^sources] The rule names the list in the message. A type name is
  case-sensitive.
- **`npm` entry.** An `npm` entry parses and matches nothing, because nothing registers an `npm`
  marketplace.[^sources] The rule reports it with its own message.
- **Fields.** A required field is missing, or a field has the wrong type.[^types]
- **`path` of `file` and `directory`.** The path must be absolute.[^types] The rule accepts a
  POSIX path and a Windows path. The result does not depend on the machine.
- **`hostPattern` and `pathPattern`.** The value must compile as a JavaScript regular expression.
  The docs say that each is a regex.[^types] The rule does not check whether the pattern is
  anchored.
- **`repo` of a `github` entry.** A `*` is valid only in the form `<owner>/*`. Claude Code ignores
  an entry such as `*`, `*/plugins` or `acme-corp/tools-*` as invalid, so it matches no
  repository.[^wildcards] The rule does not check the form of a `repo` that has no `*`.
- **`pluginTrustMessage`.** The value must be a string.[^trust] A `null` value removes the key,
  so the rule does not report it.

| Type | Required | Optional |
|------|----------|----------|
| `github` | `repo` (string) | `ref`, `path` (strings) |
| `git` | `url` (string) | `ref`, `path` (strings) |
| `url` | `url` (string) | `headers` (object) |
| `file` | `path` (absolute string) | none |
| `directory` | `path` (absolute string) | none |
| `hostPattern` | `hostPattern` (regex string) | none |
| `pathPattern` | `pathPattern` (regex string) | none |
| `skills-dir` | none | none |
| `settings` | not checked | not checked |

The rule reports at the node that has the fault. It reports a missing field at the `source`
object. When a file has two keys of one name, the rule reads the last, as `JSON.parse` does.

### What the rule does not check

- **A path target.** An absolute path is out of the repository, so the rule checks the shape only.
- **A `settings` entry.** The settings reference gives it no row. The marketplace reference says
  that an allowlist entry matches by `name` and `plugins`, and lists no required field.[^sources]
- **A key that is not an array.** The rule makes no report for it.
- **A field that the table does not list.** This includes `sparsePaths`, `headersHelper` and
  `skipLfs`.
- **A hidden drop-in.** Claude Code ignores a hidden file in `managed-settings.d/`, so the rule
  reads no key there.
- **A top-level value that is not an object.** `settings-managed-file` reports it.

Fail, in `managed-settings.json`:

```json
{
  "strictKnownMarketplaces": [
    { "source": "github", "repo": "acme-corp/tools-*" },
    { "source": "file", "path": "plugins/marketplace.json" },
    { "source": "hostPattern", "hostPattern": "^(github\\.example\\.com$" },
    { "source": "npm", "package": "acme-plugins" }
  ],
  "pluginTrustMessage": true
}
```

Pass:

```json
{
  "strictKnownMarketplaces": [
    { "source": "github", "repo": "acme-corp/*" },
    { "source": "file", "path": "/opt/acme-corp/plugins/marketplace.json" },
    { "source": "hostPattern", "hostPattern": "^github\\.example\\.com$" },
    { "source": "skills-dir" }
  ],
  "pluginTrustMessage": "All plugins from our marketplace are approved by IT"
}
```

## Sources

[^strict]: [All settings: strictKnownMarketplaces](https://code.claude.com/docs/en/settings-reference#strictknownmarketplaces)
[^blocked]: [All settings: blockedMarketplaces](https://code.claude.com/docs/en/settings-reference#blockedmarketplaces)
[^types]: [All settings: Allowed source types](https://code.claude.com/docs/en/settings-reference#allowed-source-types)
[^wildcards]: [All settings: Owner wildcards](https://code.claude.com/docs/en/settings-reference#owner-wildcards)
[^aliases]: [All settings: Marketplace key aliases](https://code.claude.com/docs/en/settings-reference#marketplace-key-aliases)
[^trust]: [All settings: pluginTrustMessage](https://code.claude.com/docs/en/settings-reference#plugintrustmessage)
[^sources]: [Marketplace reference: Marketplace sources](https://code.claude.com/docs/en/plugins/marketplace-reference#marketplace-sources)
