---
type: Reference
description: The ESLint rule claude/marketplace-source-schema, which reports an object source in a marketplace.json entry that has an unknown type, a missing or mistyped field, or a value that the docs do not allow, with the max option for the command text.
owner: brianespinosa
created: 2026-10-06
related_issues: [12]
stale_after: 2027-04-06
generated:
  by: claude-code
  at: 2026-10-06T00:00:00Z
---

# `marketplace-source-schema`

Write the object source of a marketplace entry as the docs require.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude-plugin/marketplace.json` |

## Rule details

The `source` of an entry is a relative path string, or an object. The `source` key of the object
names the type.[^sources] The rule reads each entry whose `source` is an object. It reports these
faults:

- **Type.** The `source` key is missing, is not a string, or is not one of `github`, `url`,
  `git-subdir`, `npm`, `archive` and `command`. `git` is a marketplace source type and not a plugin
  source type, so the rule reports it. `unsupported` has its own message, because the docs say that
  it is a placeholder that nobody can write.[^validation]
- **Required field.** A known type has no required field. The report is on the source object.
- **Field type.** A field that the docs list for the type is not a string. The exceptions are
  `timeout` and `mode`, below.

The fields of each type are these.[^sources]

| Type | Required | Optional |
|------|----------|----------|
| `github` | `repo` | `ref`, `sha` |
| `url` | `url` | `ref`, `sha` |
| `git-subdir` | `url`, `path` | `ref`, `sha` |
| `npm` | `package` | `version`, `registry` |
| `archive` | `url` | `sha256` |
| `command` | `command` | `timeout`, `mode` |

The docs set these limits on the values. The rule reports each value that breaks one:

- **`github` `repo`.** It is `owner/repo`.[^github] The rule accepts one slash with text on each
  side and no white space.
- **`url` `url`.** It starts with `https://`, `http://`, `file://` or `git@`.[^url] The rule ignores
  letter case in the scheme.
- **`sha`.** It is a full 40-character lowercase commit SHA.[^sources] The rule checks it for
  `github`, `url` and `git-subdir`.
- **`npm` `package`.** It does not contain `..`.[^invalid]
- **`archive` `url`.** It starts with `https://` and does not name a loopback, link-local or
  cloud-metadata host.[^archive] The rule parses the URL. It checks `localhost` and `*.localhost`,
  `127.0.0.0/8`, `::1`, `169.254.0.0/16`, `fe80::/10`, and the metadata hosts
  `metadata.google.internal`, `169.254.169.254`, `100.100.100.200` and `fd00:ec2::254`. The docs
  give no list of hosts, so the rule checks only these. A host that is not in this list gives no
  report, so a clean result does not prove that a host is safe. An IPv4-mapped IPv6 host and
  `0.0.0.0` are examples. Text that the URL parser refuses gets no host report.
- **`archive` `sha256`.** It is 64 hex characters, in upper or lower case.[^archive]
- **`command` `command`.** It is printable ASCII, has at most 500 characters, and has no run of four
  or more spaces.[^command] Each fault is a separate report. The rule counts characters as
  JavaScript does (`String.length`, UTF-16 code units). Use the `max` option to set a lower limit.
- **`command` `timeout`.** It is a whole number of seconds from 1 to 600.[^command] The rule
  reports any other number, and any value that is not a number.
- **`command` `mode`.** It is `copy` or `link`.[^command] The rule reports any other value.

The rule does not check these:

- The `path` of a `github` source. The docs say that a `github` plugin source has no `path`. They
  give no error for it.[^sources] `path` is a field of a `github` marketplace source.[^fields]
- The `url` of a `git-subdir` source beyond a string. The docs say that it takes a full git URL or
  `owner/repo`, and give no list of schemes.[^subdir]
- A key that the docs do not list for the type.
- The content of `ref`, `version` and `registry`, and the other `package` values that Claude Code
  refuses, such as a git address or a tarball link on a code host.[^npm]
- A `source` that is a string, which is for `marketplace-relative-source-format`. A `source` that is
  not a string or an object is a fault for `marketplace-schema`.

When a key appears twice, the rule reads the last, as `JSON.parse` does.

`claude plugin validate` reports `Invalid input` on a `source` that matches no type. The causes
that the docs list are an unknown type, a known type with a required field that is missing or has
the wrong type, and an `npm` `package` that contains `..`. It also reports the `unsupported`
placeholder.[^validation][^invalid] The docs do not list a validate message for the `sha`, `sha256`,
host, `command`, `timeout` and `mode` limits, so the rule reports cases that validate may not.

Fail:

```json
{
  "name": "acme",
  "owner": { "name": "Acme" },
  "plugins": [
    { "name": "formatter", "source": { "source": "github", "repo": "formatter" } }
  ]
}
```

Pass:

```json
{
  "name": "acme",
  "owner": { "name": "Acme" },
  "plugins": [
    { "name": "formatter", "source": { "source": "github", "repo": "your-org/formatter" } }
  ]
}
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `max` | `500` | The most characters in a `command`. An integer from 1 to 500. Optional. |

```js
'claude/marketplace-source-schema': ['error', { max: 200 }]
```

The default is the limit in the docs.[^command] The schema sets 500 as the maximum, because no
Claude Code setting moves that limit. A team can set a lower value. A config that sets only the
severity keeps the default. The `recommended` and `strict` configs set no option.

At the default, the message says that the docs allow at most 500. At another value, the message
says "The configured limit is 200", and it does not say what the docs allow.

The `timeout` range has no option. The docs give 1 to 600 as the valid range, and no Claude Code
setting moves it.[^command] The range is a rule of validity, as are the 40 and 64 characters of the
two SHA values. It is not a size limit that Claude Code cuts at. A lower top value would be a team
policy, and the docs give no reason to set one.

## Sources

[^sources]: [Marketplace reference: Plugin sources](https://code.claude.com/docs/en/plugins/marketplace-reference#plugin-sources)
[^github]: [Marketplace reference: github plugin source](https://code.claude.com/docs/en/plugins/marketplace-reference#github-plugin-source)
[^url]: [Marketplace reference: url plugin source](https://code.claude.com/docs/en/plugins/marketplace-reference#url-plugin-source)
[^subdir]: [Marketplace reference: git-subdir plugin source](https://code.claude.com/docs/en/plugins/marketplace-reference#git-subdir-plugin-source)
[^npm]: [Marketplace reference: npm plugin source](https://code.claude.com/docs/en/plugins/marketplace-reference#npm-plugin-source)
[^archive]: [Marketplace reference: archive plugin source](https://code.claude.com/docs/en/plugins/marketplace-reference#archive-plugin-source)
[^command]: [Marketplace reference: command plugin source](https://code.claude.com/docs/en/plugins/marketplace-reference#command-plugin-source)
[^invalid]: [Marketplace reference: Invalid input on a source](https://code.claude.com/docs/en/plugins/marketplace-reference#invalid-input-on-a-source)
[^validation]: [Marketplace reference: Validation messages](https://code.claude.com/docs/en/plugins/marketplace-reference#validation-messages)
[^fields]: [Marketplace reference: Fields by type](https://code.claude.com/docs/en/plugins/marketplace-reference#fields-by-type)
