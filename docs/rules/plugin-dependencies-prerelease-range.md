---
type: Reference
description: The ESLint rule claude/plugin-dependencies-prerelease-range, which reports a version range of a plugin dependency that does not match the pre-release version of the dependency until it has a pre-release suffix such as -0, with examples and sources.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-dependencies-prerelease-range`

Give a dependency range a pre-release suffix when it must match a pre-release version.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `strict` | `warn` | no-op | `**/.claude-plugin/plugin.json` |

## Rule details

A dependency of a plugin can carry a version range, such as `^2.0` or `~2.1.0`.[^constraint] The docs
say: "A range doesn't match pre-release versions such as `2.0.0-beta.1` unless you opt in with a
pre-release suffix such as `^2.0.0-0`." So `^2.0.0` does not match `2.0.0-beta.1`.

The rule reports the `version` range of a dependency object when two things hold. The dependency
has a pre-release version in the files of the repository. And a `-0` suffix on the versions of the
range that have the same major, minor and patch numbers as that version would make the range match
it. The report is on the range. The suffix `-0` is the lowest pre-release, so it matches each
pre-release of the same numbers. A range that no suffix can fix gets no report. For example, `^1.0.0`
and the target `2.0.0-beta.1` get none, and neither do `<2.0.0` and the same target.

The target version is a heuristic, so the rule is `off` in `recommended`. Claude Code resolves a
dependency with a git source by git tag, and checks the range against the version of the tag.[^tags]
Tags are not files in the repository. A relative-path dependency also resolves by tag when the
marketplace repository has tags. The files give the version only when no tag fits. So the rule
reads the version that the files give, in the order of the loading page: the `version` in the
`plugin.json` of the dependency, then the `version` in its marketplace entry.[^version] The
manifest is read when the entry has a relative source, which is `.` or starts with `./`. A bare name
under `pluginRoot` gets no report, because the rule does not read that manifest. A `command` source
gets no report, because Claude Code ignores the entry `version` of that source.

The rule reads the dependencies in the same marketplace only. It reads the `marketplace.json` that
encloses the plugin, and finds the entry by name, as `plugin-dependencies-resolve` does.

The rule reads a range in this form: one to three numbers, with the operator `^`, `~`, `>=`, `>`,
`<=`, `<` or `=`, or with no operator. Tokens are split by spaces, and alternatives by `||`. A
space between an operator and its version, as in `>= 2.0.0`, is allowed. The
semantic version pattern of `plugin-manifest-version-semver` checks the target. The rule reads a
partial version, such as `^2.0`, as `node-semver` does.

The rule makes no report in these cases:

- The range has an `x` or `*`, a `v` prefix, a pre-release part, a build part, a hyphen range, or
  any other form that the rule does not read. A range that already has a pre-release suffix is one
  of them.
- The target is not a semantic version, has no pre-release part, or is absent. An entry that
  has an object source and sets no `version`, has no target.
- The source of the entry is a bare name under `pluginRoot`, or a `command` source.
- The dependency is a string, has no `version` string, is in another marketplace, or has no entry or
  two entries in the marketplace. The plugin has no entry in the marketplace.
- The source folder of the entry is a link with no target, or its real path is out of the
  repository, or its manifest fails to read or to parse.
- The rule cannot see the plugin or the `marketplace.json`. The plugin root can be unseen. The real
  path of the plugin root, of `.claude-plugin/` or of `plugin.json` can be out of the repository.
  The files can fail to parse.

Fail: the dependency `{ "name": "dep", "version": "^2.0.0" }`, when the entry of `dep` has the
version `2.0.0-beta.1`.

Pass: the same dependency with the range `^2.0.0-0`, or with the entry version `2.0.0`.

## Sources

[^constraint]: [Plugin dependencies: Declare a dependency with a version constraint](https://code.claude.com/docs/en/plugins/dependencies#declare-a-dependency-with-a-version-constraint)
[^tags]: [Plugin dependencies: How a constraint resolves against tags](https://code.claude.com/docs/en/plugins/dependencies#how-a-constraint-resolves-against-tags)
[^version]: [Plugin loading reference: How Claude Code computes the version](https://code.claude.com/docs/en/plugins/loading#how-claude-code-computes-the-version)
