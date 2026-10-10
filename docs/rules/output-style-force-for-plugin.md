---
type: Reference
description: The ESLint rule claude/output-style-force-for-plugin, which reports force-for-plugin true in a plugin output style, because the style then overrides the outputStyle setting of each user who enables the plugin.
owner: brianespinosa
created: 2026-10-10
related_issues: [9]
stale_after: 2027-04-01
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `output-style-force-for-plugin`

Do not force the output style of a plugin on each user.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/output-styles/*.md` |

## Rule details

`force-for-plugin: true` applies the style whenever the plugin is enabled. The user does not
select it. The style overrides the `outputStyle` setting of the user. If several enabled plugins
set the field, Claude Code uses the first one loaded.[^fields] A plugin that forces a style
takes the choice from the user, so the rule reports it. Keep the field if the plugin cannot work
without the style.

The rule reads the same Boolean forms as the other Boolean fields, by inference. The docs show
only `true`.[^fields] `yes`, `on` and `1` also report. A value that is not a Boolean is for
[`output-style-frontmatter-schema`](output-style-frontmatter-schema.md).

The field works only in a plugin style.[^fields] The rule checks only styles in the
`output-styles/` directory of a plugin. [`output-style-frontmatter-schema`](output-style-frontmatter-schema.md)
reports the field in a local style. The rule ignores a file whose frontmatter does not parse.

The docs also say a plugin can set `outputStyles` in its manifest, and that this replaces the
default `output-styles/` scan.[^combine] The rule does not read the manifest. It reports a file
in `output-styles/` that the manifest may leave out.

The row `output-style-force-for-plugin-unique` is not a rule. The set of enabled plugins is user
state, and a repository does not show it.

Fail, in `output-styles/terse.md` of a plugin:

```markdown
---
name: terse
description: Answer in as few words as possible
force-for-plugin: true
---
```

Pass: the same file without `force-for-plugin`, or with `force-for-plugin: false`.

## Options

None.

## Sources

[^fields]: [Output styles: Frontmatter reference](https://code.claude.com/docs/en/output-styles#frontmatter)
[^combine]: [Plugins reference: How each key combines with its default location](https://code.claude.com/docs/en/plugins/manifest-reference#how-each-key-combines-with-its-default-location)
