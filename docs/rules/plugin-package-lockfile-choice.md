---
type: Reference
description: The ESLint rule claude/plugin-package-lockfile-choice, which reports a plugin with more than one lockfile that Claude Code reads, and a plugin with a bun.lock and no npm lockfile, because Claude Code reads the first match and does not fall back to another package manager.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-package-lockfile-choice`

Ship one lockfile with the `package.json` of a plugin, and prefer an npm lockfile.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | practice | `**/.claude-plugin/plugin.json` |

## Rule details

When a plugin root has a `package.json` and a supported lockfile, Claude Code installs the
dependencies of the plugin. The lockfile decides which package manager runs: `bun.lock` runs Bun,
and `npm-shrinkwrap.json` or `package-lock.json` runs npm.[^runs] If a plugin has more than one of
these lockfiles, Claude Code uses the first match, in this order: `bun.lock`, `npm-shrinkwrap.json`,
`package-lock.json`.[^runs] Claude Code runs the package manager from the `PATH` of the user. If
that manager is missing, it does not try the other lockfile.[^runs] The docs say to include an npm
lockfile to reach the most users.[^runs]

The rule reports a plugin in two cases. Both need a `package.json` at the plugin root.

- The plugin root has two or more of the three lockfiles. Claude Code ignores all but the first.
  The message names the first match. If `bun.lock` is among them, the plugin still depends on Bun.
- The plugin root has `bun.lock` and neither npm lockfile. A user without Bun gets no install.

The report is on the manifest. The rule counts only the three lockfiles that Claude Code reads.
[`plugin-package-lockfile`](plugin-package-lockfile.md) owns the lockfiles that Claude Code skips
(`bun.lockb`, `pnpm-lock.yaml` and `yarn.lock`), so a skipped lockfile beside an npm lockfile is
correct. The order of the lockfiles is the list that `plugin-package-lockfile` exports. The test
of this rule pins that order to the loading page.

The rule makes no report in these cases:

- The plugin has no `package.json`, or one lockfile of an npm kind.
- A name is a folder, and not a file. The rule counts it as absent.
- The rule cannot see one of the four files. The real path of the entry can be out of the
  repository, or a part of the path can be a link with no target. Such a file could be the first
  match, or an npm lockfile.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of
  the plugin root, of `.claude-plugin/` or of `plugin.json` can be out of the repository. The manifest can fail to
  parse.

Only the plugin root counts. The rule reads no lockfile content and no `lockfileVersion`.

Fail: a plugin root with `package.json`, `bun.lock` and `package-lock.json`.

Pass: a plugin root with `package.json` and `package-lock.json`.

## Options

None.

## Sources

[^runs]: [Plugin loading reference: When the dependency install runs](https://code.claude.com/docs/en/plugins/loading#when-the-dependency-install-runs)
