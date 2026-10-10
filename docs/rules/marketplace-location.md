---
type: Reference
description: The ESLint rule claude/marketplace-location, which reports a marketplace.json with a plugins array that is not in a .claude-plugin directory, because claude plugin marketplace add cannot find it.
owner: brianespinosa
created: 2026-10-10
related_issues: [12]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `marketplace-location`

Keep `marketplace.json` in the `.claude-plugin` directory of the marketplace root.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/marketplace.json` |

## Rule details

Claude Code reads the marketplace file at `.claude-plugin/marketplace.json` in the marketplace
directory. If the file is elsewhere in the repository, `claude plugin marketplace add` cannot find
it. Users must then declare the marketplace in `extraKnownMarketplaces`, with `path` set on its
source.[^file] A file in another place is a valid choice for a team that sets that `path`. So the
rule is a `warn`.

The rule reports a file named `marketplace.json` when two things are true:

- The folder of the file is not named `.claude-plugin`.
- The top-level `plugins` member is an array. A file with no `plugins` array is not known to be a
  marketplace, and the rule does not report it.

The report is on the top-level object. The rule reads the path of the linted file and its text. It
reads no other file. When a file has two `plugins` keys, the rule reads the last, as `JSON.parse`
does.

The shipped `marketplace-*` rules read `.claude-plugin/marketplace.json` only. They do not lint a
file that this rule reports.

Fail (`docs/marketplace.json`):

```json
{
  "name": "acme",
  "owner": { "name": "Acme" },
  "plugins": [{ "name": "formatter", "source": "./plugins/formatter" }]
}
```

Pass: the same text at `.claude-plugin/marketplace.json`.

## Options

None.

## Sources

[^file]: [Marketplace reference: Marketplace file](https://code.claude.com/docs/en/plugins/marketplace-reference#marketplace-file)
