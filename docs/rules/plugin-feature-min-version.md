---
type: Reference
description: The ESLint rule claude/plugin-feature-min-version, which with the option minVersion reports a plugin.json feature that a Claude Code older than minVersion cannot load, namely skills ".", metadata and userConfig options, with its option, examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-feature-min-version`

Use no `plugin.json` feature that is newer than the oldest Claude Code that the repository supports.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/.claude-plugin/plugin.json` |

The rule makes no report until the option `minVersion` is set.

## Rule details

Some `plugin.json` features need a recent Claude Code. An older version can reject or ignore a
feature. `claude plugin validate` checks the manifest against the version that runs it, so it
cannot tell which older version fails. The rule reports each of these features when `minVersion`
is older than the version that added it:

| Feature | Added in | What older versions do | Source |
|---------|----------|------------------------|--------|
| `"."` as a `skills` path | v2.1.221 | Manifest validation fails. Use `"./"`, which means the same.[^path-rules] | Path rules |
| The `metadata` key | v2.1.222 | The docs state that the key needs v2.1.222 or later.[^metadata] | `metadata` |
| `options` on a `userConfig` field | v2.1.271 | The plugin fails to load.[^options] | Limit a field to fixed options |

The rule reports these places:

- Each `"."` string in the `skills` key, whether it is the value or an element of an array. The
  report is on the string.
- The `metadata` member, whatever its value.
- The `options` member of each field in `userConfig`.

The directory listing fields (`icon`, `documentationUrl` and others) are not checked. Before
v2.1.281, `claude plugin validate` prints an `Unknown field` warning for them, so a `--strict`
run fails. Claude Code ignores these fields at load time.[^listing]

The rule makes no report in these cases:

- The option `minVersion` is not set.
- The option is equal to or newer than the version that added the feature.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of
  the plugin root, of `.claude-plugin/` or of `plugin.json` can be out of the repository. The
  manifest can fail to parse.

When a key appears twice, the rule reads the last one, as `JSON.parse` does.

Fail, with `minVersion` set to `2.1.200`: `"skills": "."`, `"metadata": {}`, or a `userConfig`
field with `"options": ["a", "b"]`.

Pass: `"skills": "./"`.

## Options

| Option | Default | Use |
|--------|---------|-----|
| `minVersion` | unset | The oldest Claude Code version that the repository supports, such as `2.1.200`. Optional. |

```js
'claude/plugin-feature-min-version': ['warn', { minVersion: '2.1.200' }]
```

With no `minVersion`, the rule is inactive and makes no report. The `recommended` and `strict`
configs set no option, so a team turns the rule on when it sets its floor. The value has three
numbers, such as `2.1.221`.

## Sources

[^path-rules]: [Plugin manifest reference: Path rules](https://code.claude.com/docs/en/plugins/manifest-reference#path-rules)
[^metadata]: [Plugin manifest reference: metadata](https://code.claude.com/docs/en/plugins/manifest-reference#metadata)
[^options]: [Plugin manifest reference: Limit a field to fixed options](https://code.claude.com/docs/en/plugins/manifest-reference#limit-a-field-to-fixed-options)
[^listing]: [Plugin manifest reference: Directory listing fields](https://code.claude.com/docs/en/plugins/manifest-reference#directory-listing-fields)
