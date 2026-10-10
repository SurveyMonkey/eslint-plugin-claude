---
type: Reference
description: The ESLint rule claude/plugin-manifest-version-semver, which reports a plugin.json whose version is not a semantic version, because a dependency range and a release tag need one, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-manifest-version-semver`

Set the `version` of `plugin.json` to a semantic version.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude-plugin/plugin.json` |

## Rule details

The `version` key of `plugin.json` is a version string that Claude Code does not check against
semver.[^version] `claude plugin validate` does not check it either. It warns only when `version`
is missing.

Other features of a plugin do need semver. A dependency on the plugin has a version range, which
Claude Code resolves against the git tags of the plugin.[^tag] Each release tag reads
`<plugin-name>--v<version>`, and `<version>` matches the `version` field of `plugin.json` in that
commit.[^tag] A version such as `1.0` or `latest` gives a tag that no range matches.

The rule reports the value of `version` when it is a string that is not a semantic version of
semver.org 2.0.0. That version has three numbers with no leading zero, an optional prerelease
after `-`, and optional build metadata after `+`. A leading `v` is not part of the version: the
tag adds it.

The report is on the value. The rule makes no report in these cases:

- The manifest has no `version` key, or the value is not a string.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of
  the plugin root, of `.claude-plugin/` or of `plugin.json` can be out of the repository. The
  manifest can fail to parse.

When a key appears twice, the rule reads the last one, as `JSON.parse` does.

Fail: `"version": "1.0"`.

Pass: `"version": "1.0.0"`, `"version": "2.1.0-beta.1"`, or no `version` key.

## Options

None.

## Sources

[^version]: [Plugin manifest reference: version](https://code.claude.com/docs/en/plugins/manifest-reference#version)
[^tag]: [Plugin dependencies: Create a release tag](https://code.claude.com/docs/en/plugins/dependencies#create-a-release-tag)
