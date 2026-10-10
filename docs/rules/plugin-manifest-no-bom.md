---
type: Reference
description: The ESLint rule claude/plugin-manifest-no-bom, which reports a plugin.json that starts with a byte order mark, because Claude Code before v2.1.246 fails to install such a plugin, with its option, examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-manifest-no-bom`

Save `plugin.json` with no byte order mark.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/.claude-plugin/plugin.json` |

The rule makes no report until the option `minVersion` is set.

## Rule details

The manifest file of a plugin is `.claude-plugin/plugin.json`.[^manifest] Claude Code 2.1.246 fixed
the install of a plugin whose manifest was saved with a UTF-8 BOM (byte order mark). Before that
version, the install failed. The mark is the three bytes `EF BB BF`. Some Windows editors add it
when they save a file as "UTF-8 with BOM".

No page of the docs states this fault. The 2.1.246 entry in the
[changelog file](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) states it.

`claude plugin validate` on Claude Code 2.1.296 accepts a manifest with the mark. So the rule is
useful only for a repository that supports an older Claude Code.

The rule reports a `plugin.json` that starts with the mark. The report is on line 1, column 1.

ESLint removes the mark before a rule sees the text. So the rule reads the first three bytes of
the file on disk. It does not read the text in the editor, so the text can differ from the saved
file. The rule makes no report in these cases:

- The file is not on disk, as in a lint of text with no saved file.
- The file is a link to a file outside the repository, or the link has no target.
- The plugin root has a real path outside the repository.
- The rule has no read access to the file.

To remove the mark, save the file again as "UTF-8" and not as "UTF-8 with BOM".

Fail (the file starts with the three bytes of the mark, here written as `[BOM]`):

```json
[BOM]{ "name": "deploy-tools" }
```

Pass:

```json
{ "name": "deploy-tools" }
```

## Options

| Option | Default | Use |
|--------|---------|-----|
| `minVersion` | unset | The oldest Claude Code version that the repository supports, such as `2.1.200`. Optional. |

```js
'claude/plugin-manifest-no-bom': ['warn', { minVersion: '2.1.200' }]
```

With no `minVersion`, the rule is inactive and makes no report. The `recommended` and `strict`
configs set no option, so a team turns the rule on when it sets its floor. The example turns the
rule on for a floor older than 2.1.246. When `minVersion` is `2.1.246` or later, the rule makes
no report. The value has three numbers, such as `2.1.246`.

## Sources

[^manifest]: [Plugin manifest reference: Manifest file](https://code.claude.com/docs/en/plugins/manifest-reference#manifest-file)
