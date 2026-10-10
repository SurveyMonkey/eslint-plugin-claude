---
type: Reference
description: The ESLint rule claude/plugin-package-lockfile, which reports a plugin that has a package.json and only a yarn.lock, pnpm-lock.yaml or bun.lockb lockfile, because Claude Code reads none of them and skips the dependency install.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-package-lockfile`

Ship a lockfile that Claude Code reads with the `package.json` of a plugin.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | no-op | `**/.claude-plugin/plugin.json` |

## Rule details

When Claude Code copies a plugin into its cache, it installs the Node.js dependencies of the
plugin. The install runs only when the plugin root has a `package.json` and a supported
lockfile.[^runs] Claude Code reads three lockfiles: `bun.lock`, `npm-shrinkwrap.json` and
`package-lock.json`. It skips the install for `bun.lockb` and for `yarn.lock` or
`pnpm-lock.yaml`.[^runs] The plugin still loads, but the parts that need the packages can fail.[^skipped]

The rule reports a plugin when all of these are true:

- The plugin root has a `package.json` file.
- The plugin root has none of `bun.lock`, `npm-shrinkwrap.json` and `package-lock.json`.
- The plugin root has at least one of `bun.lockb`, `pnpm-lock.yaml` and `yarn.lock`.

The report is on the manifest. The message names the lockfiles that Claude Code skips.
To fix it, add an npm lockfile.[^runs] A plugin with a supported lockfile beside a skipped one is
correct: Claude Code uses the supported lockfile. The rule does not report the use of two
supported lockfiles. It does not read the content of a lockfile or of `package.json`.

The rule makes no report in these cases:

- The plugin has no `package.json`, or has a `package.json` and no lockfile.
- A name is a folder, and not a file.
- The rule cannot see a supported lockfile or the `package.json`. The real path of the entry can
  be out of the repository. A part of the path can be a link with no target.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of
  `.claude-plugin/` or of `plugin.json` can be out of the repository. The manifest can fail to
  parse.

Only the plugin root counts. The docs say the install runs when the root directory holds both
files.[^runs] The rule does not report `bunfig.toml`. Claude Code runs the install in a folder of
its own, so Bun does not read that file.[^limits]

Fail: a plugin root with `package.json` and `yarn.lock`.

Pass: a plugin root with `package.json` and `package-lock.json`.

## Options

None.

## Sources

[^runs]: [Plugin loading reference: When the dependency install runs](https://code.claude.com/docs/en/plugins/loading#when-the-dependency-install-runs)
[^skipped]: [Plugin loading reference: When the dependency install fails or is skipped](https://code.claude.com/docs/en/plugins/loading#when-the-dependency-install-fails-or-is-skipped)
[^limits]: [Plugin loading reference: Limits on the dependency install](https://code.claude.com/docs/en/plugins/loading#limits-on-the-dependency-install)
