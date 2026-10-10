---
type: Reference
description: The ESLint rule claude/plugin-npm-source-shrinkwrap, which reports a plugin with a package.json and no npm-shrinkwrap.json when its marketplace entry has an npm source, because npm leaves package-lock.json out of a published package.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-npm-source-shrinkwrap`

Ship `npm-shrinkwrap.json` with a plugin that a marketplace serves from npm.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude-plugin/plugin.json` |

## Rule details

Claude Code installs the Node.js dependencies of a plugin when the plugin root has a
`package.json` and a lockfile that it reads: `bun.lock`, `npm-shrinkwrap.json` or
`package-lock.json`.[^runs] For a plugin that is distributed through an npm source, use
`npm-shrinkwrap.json`, because npm excludes `package-lock.json` from published packages.[^runs]
A published package without a shrinkwrap file has no lockfile, so Claude Code skips the install.

The rule finds the marketplace entry of the plugin. The marketplace is the nearest
`.claude-plugin/marketplace.json`, from the plugin root up to the repository root. The entry is
the one whose `name` is the `name` of the plugin. The rule reports the `name` of the plugin when
all of these are true:

- The `source` of the entry is an object with `"source": "npm"`.
- The plugin root has a `package.json` file.
- The plugin root has no `npm-shrinkwrap.json` file and no `bun.lock` file.

The report is on the `name` of `plugin.json`. To fix it, run `npm shrinkwrap` and commit the
file. A plugin that ships `package-lock.json` only is reported, because npm drops that file.

The rule checks less than the row of the inventory. The only link between a plugin in the
repository and an entry with an `npm` source is the name. The entry does not point at a folder.
`plugin-package-lockfile` reports a plugin with a lockfile that Claude Code skips. This rule
reports the missing shrinkwrap of a plugin that an npm source serves, whatever other lockfiles it has, except `bun.lock`. Claude Code installs from `bun.lock`.

The rule makes no report in these cases:

- The plugin is in no marketplace of the repository, or no entry has its name.
- The entry has another source: a relative path, `github`, `url`, `git-subdir`, `archive` or
  `command`.
- The plugin has no `package.json`, or a name is a folder and not a file.
- The manifest has no string `name`.
- The rule cannot see the `marketplace.json`, the `package.json` or the `npm-shrinkwrap.json`.
  The file can fail to parse. Its real path can be out of the repository, or it can be a link with
  no target.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of
  the plugin root, of `.claude-plugin/` or of `plugin.json` can be out of the repository. The
  manifest can fail to parse.

The rule reads files on disk, not the files that Git tracks, and not the files that npm packs.

Fail: a marketplace entry `{ "name": "p", "source": { "source": "npm", "package": "@acme/p" } }`,
and a plugin `p` with a `package.json` and no `npm-shrinkwrap.json`.

Pass: the same plugin with an `npm-shrinkwrap.json`.

## Options

None.

## Sources

[^runs]: [Plugin loading reference: When the dependency install runs](https://code.claude.com/docs/en/plugins/loading#when-the-dependency-install-runs)
