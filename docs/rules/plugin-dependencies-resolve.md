---
type: Reference
description: The ESLint rule claude/plugin-dependencies-resolve, which reports a dependency in plugin.json that the marketplace of the plugin does not list, and a dependency from another marketplace that allowCrossMarketplaceDependenciesOn does not name, because Claude Code installs neither.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-dependencies-resolve`

Name only dependencies that the marketplace of the plugin resolves.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | consistency | `**/.claude-plugin/plugin.json` |

## Rule details

The `dependencies` array of `plugin.json` lists plugins that must be enabled for this plugin to
work. An entry is `"name"`, `"name@marketplace"`, or an object with `name`, `marketplace` and
`version`.[^field] Claude Code looks up a name with no marketplace in the marketplace of the
plugin that declares it.[^declare] A dependency from another marketplace is not installed unless the
`marketplace.json` of the root marketplace lists that marketplace in
`allowCrossMarketplaceDependenciesOn`. When a dependency of `plugin.json` is refused, the install
completes without it, and the plugin then fails to load.[^cross]

The rule reads the `marketplace.json` that encloses the plugin. That file is in the nearest
`.claude-plugin/` folder, from the plugin root up to the repository root. The rule reports each
dependency of `plugin.json` in these cases:

- The dependency has no marketplace, or names the marketplace of the file, and no entry of
  `plugins` has its name.
- The dependency names another marketplace, and the file has no
  `allowCrossMarketplaceDependenciesOn`, or that array does not hold the name of the marketplace.

The report is on the dependency. To fix it, add the plugin to the marketplace, or add the
marketplace to `allowCrossMarketplaceDependenciesOn`.

The rule checks less than the row of the inventory. A dependency from another marketplace gets no
check of its name, because the repository does not hold that marketplace. The rule also does not
check that a constrained dependency with an `npm`, `archive` or `command` source sets `version` in
its `plugin.json`.[^constrain] That file is in the package, the archive or the output of the
command, and not in the repository. A rule makes no report that rests on a file out of the
repository.

The rule makes no report in these cases:

- The plugin is in no marketplace of the repository.
- The `marketplace.json` has no string `name`, or its `plugins` value is not an array. The
  marketplace rules report those.
- `allowCrossMarketplaceDependenciesOn` is set to a value that is not an array.
- A dependency is not a string, or is an object whose `name` or `marketplace` is not a string.
- The rule cannot see the `marketplace.json`. It can fail to parse, or not be an object. Its real
  path can be out of the repository, or it can be a link with no target.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of
  the plugin root, of `.claude-plugin/` or of `plugin.json` can be out of the repository. The
  manifest can fail to parse.

The rule reads the dependencies of `plugin.json` only. It does not read the `dependencies` of a
marketplace entry.

Fail: `"dependencies": ["audit-logger"]` in a plugin of a marketplace that has no entry with the
name `audit-logger`.

Pass: the same dependency, with an entry named `audit-logger` in `plugins`.

## Options

None.

## Sources

[^field]: [Plugin manifest reference: dependencies](https://code.claude.com/docs/en/plugins/manifest-reference#dependencies)
[^declare]: [Plugin dependencies: Declare a dependency with a version constraint](https://code.claude.com/docs/en/plugins/dependencies#declare-a-dependency-with-a-version-constraint)
[^cross]: [Plugin dependencies: Depend on a plugin from another marketplace](https://code.claude.com/docs/en/plugins/dependencies#depend-on-a-plugin-from-another-marketplace)
[^constrain]: [Plugin dependencies: Constrain a dependency that has a non-git source](https://code.claude.com/docs/en/plugins/dependencies#constrain-a-dependency-that-has-a-non-git-source)
