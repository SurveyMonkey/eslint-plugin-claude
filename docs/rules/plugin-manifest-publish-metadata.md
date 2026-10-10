---
type: Reference
description: The ESLint rule claude/plugin-manifest-publish-metadata, which reports a plugin that sets no homepage or repository in plugin.json, or has no README.md at the plugin root, because the docs ask for these before a release, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-manifest-publish-metadata`

Set `homepage` and `repository` in `plugin.json`, and add a `README.md` at the plugin root.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude-plugin/plugin.json` |

## Rule details

The docs ask for `description`, `author`, `homepage` and `repository` in `plugin.json` before a
release. They also ask for a `README.md` at the plugin root.[^publish] `claude plugin validate`
warns about a missing `description` and `author`, but not about a missing `homepage`,
`repository` or `README.md`. So this rule checks the rest.

The rule makes one report for a manifest, on line 1. The message lists what is missing, in this
order: `homepage`, `repository`, `README.md`. A key is missing when it is not in the manifest.
A key is also missing when its value is a string of spaces only. The README is missing when the
plugin root holds no file with the name `README.md`. A file system that ignores case can accept
`readme.md`, so the result can differ between machines.

The rule makes no report in these cases:

- The value of `homepage` or `repository` is not a string. `claude plugin validate` reports a
  value of the wrong type.
- The plugin is in `.claude/skills/<name>/`. Claude Code loads such a plugin in place, and
  nobody publishes it.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of
  the plugin root, of `.claude-plugin/` or of `plugin.json` can be out of the repository. The
  manifest can fail to parse.

If the README is a link with no target, or a link out of the repository, or the rule cannot read
it, the rule does not list `README.md` as missing.

The rule does not check that `homepage` parses as a URL. A `homepage` that does not parse makes
the plugin fail to load.[^fields] The rule `plugin-manifest-metadata-format` checks the form
of `repository`.

Fail: a manifest of `{ "name": "deploy-tools" }`.

Pass: a manifest with `"homepage": "https://example.com/deploy-tools"` and
`"repository": "https://github.com/acme/deploy-tools"`, and a `README.md` at the plugin root.

## Options

None.

## Sources

[^publish]: [Publish and distribute a plugin: Prepare your plugin for release](https://code.claude.com/docs/en/plugins/publish#prepare-your-plugin-for-release)
[^fields]: [Plugin manifest reference: Fields](https://code.claude.com/docs/en/plugins/manifest-reference#fields)
