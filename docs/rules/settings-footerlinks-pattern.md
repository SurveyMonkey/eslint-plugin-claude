---
type: Reference
description: The ESLint rule claude/settings-footerlinks-pattern, which reports a footerLinksRegexes entry in a managed settings file with a nested quantifier in its pattern, a URL template over 2048 characters, or a label over 28 display columns, with the options maxUrlChars and maxLabelColumns.
owner: brianespinosa
created: 2026-10-10
related_issues: [14]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `settings-footerlinks-pattern`

Keep each `footerLinksRegexes` entry of a managed settings file within the limits of the docs.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | limit | `**/managed-settings.json`, `**/managed-settings.d/*.json` |

## Rule details

`footerLinksRegexes` turns IDs in the output of a turn into badges below the input box. The
settings reference gives three limits for each entry.[^badges]

- **Pattern.** Claude Code matches each `pattern` on the main thread, so a slow regex blocks the
  UI. A nested quantifier such as `(a+)+$` can take exponentially long and freeze the session. The
  docs say to keep each pattern linear and to not nest `+` or `*`.
- **URL.** Claude Code drops a constructed URL of more than 2048 characters.
- **Label.** Claude Code cuts a label to 28 display columns.

The rule reports a `pattern` when a group holds a `+` or `*`, and another `+` or `*` follows the
group. The rule never runs the pattern. It scans the text of the pattern, and skips an escaped
character and the inside of a character class. It reports `(a+)+`, `(a|b*)*` and `((a)+b)+`. It
does not report `(a+)?`, `(a)+`, `a+b+` or `\b(?<key>PROJ-\d+)\b`. A pattern that is not valid
regex text gets no report and causes no error.

The rule reports a `url` or a `label` string when its literal text is over the limit. The literal
text is the string without its `{name}` placeholders, because Claude Code fills each one from a
capture group. The constructed URL or label is not shorter than the literal text, so the report is
a certain fault. Most characters take one display column. A wide East Asian character or an emoji takes two. An
accent mark takes none. The docs give no table of widths, so the count is an approximation.

Each report is on the string. When an entry has two keys of one name, the rule reads the last, as
`JSON.parse` does.

### Files

The settings reference gives `footerLinksRegexes` the scope "User or managed". A user file is not in
a repository. The rule reads the managed files only. `settings-key-scope` reports the key in a
project file, where Claude Code ignores it. The rule skips a hidden drop-in, which Claude Code
ignores.

### What the rule does not check

- The URL scheme and the form of `url`. `settings-schema` reports them.
- A value that is not a string, and a list of another type. `settings-schema` reports the type.
- The badge count. The docs give at most 5 badges, and they are the matches of a turn, not entries.
- A pattern that has a slow form without a nested quantifier, such as `(a|aa)+`.

Fail:

```json
{
  "footerLinksRegexes": [
    {
      "type": "regex",
      "pattern": "(PROJ-\\d+)+",
      "url": "https://issues.example.com/browse/{key}",
      "label": "{key}"
    }
  ]
}
```

Pass:

```json
{
  "footerLinksRegexes": [
    {
      "type": "regex",
      "pattern": "\\b(?<key>PROJ-\\d+)\\b",
      "url": "https://issues.example.com/browse/{key}",
      "label": "{key}"
    }
  ]
}
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `maxUrlChars` | `2048` | The most characters of the literal text of a `url`. An integer from 1 to 2048. Optional. |
| `maxLabelColumns` | `28` | The most display columns of the literal text of a `label`. An integer from 1 to 28. Optional. |

```js
'claude/settings-footerlinks-pattern': ['warn', { maxUrlChars: 512, maxLabelColumns: 16 }]
```

Each default is the limit in the docs.[^badges] No Claude Code setting moves a limit, so the schema
sets it as the maximum of its option. A team can set a lower value. A config that sets only the
severity keeps the defaults. The `recommended` and `strict` configs set no option.

At the default, the message says what Claude Code does. At another value, the message says "The
configured limit is 512 characters". It does not say what the docs allow.

## Sources

[^badges]: [All settings: Badge constraints](https://code.claude.com/docs/en/settings-reference#badge-constraints)
