---
type: Reference
description: The ESLint rule claude/plugin-package-lifecycle-scripts, which reports a preinstall, install or postinstall script in the package.json at a plugin root, because Claude Code installs the dependencies of a plugin with --ignore-scripts and never runs them.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-package-lifecycle-scripts`

Do not rely on a lifecycle script in the `package.json` of a plugin.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | limit | `**/package.json` |

## Rule details

When Claude Code copies a plugin into its cache, it installs the Node.js dependencies of the
plugin. The install is constrained so that no code from the plugin or its packages runs during
it.[^limits] The docs say that `--ignore-scripts` keeps the `preinstall`, `install` and
`postinstall` scripts from running.[^limits] A package that builds a native module in one of these
scripts is downloaded, and not built.

The rule reports a `preinstall`, `install` or `postinstall` entry in the `scripts` object of the
`package.json` at a plugin root. The report is on the name of the script. The fix is to run the
step before you publish the plugin, or from a hook into the persistent data directory.[^skipped]

The docs name the three script names, and do not limit the sentence to the packages that the plugin
depends on. So the rule reports the scripts of the plugin package too. The rule does not report
`prepare`, `prepublishOnly` or any other script, because the docs do not name them.

The rule makes no report in these cases:

- The `package.json` is not at the plugin root. A nested `package.json` is not the file that the
  install reads.[^runs]
- A script value is not a string.
- The `package.json` has no `scripts` object.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of
  the plugin root, of `.claude-plugin/` or of `plugin.json` can be out of the repository. The manifest can fail to
  parse.

The rule has no threshold, because it compares no number. The docs give a 60-second timeout for the
install, and the rule does not check it.

Fail: `{"scripts": {"postinstall": "node setup.js"}}` in the `package.json` at a plugin root.

Pass: `{"scripts": {"build": "tsc"}}`.

## Options

None.

## Sources

[^limits]: [Plugin loading reference: Limits on the dependency install](https://code.claude.com/docs/en/plugins/loading#limits-on-the-dependency-install)
[^runs]: [Plugin loading reference: When the dependency install runs](https://code.claude.com/docs/en/plugins/loading#when-the-dependency-install-runs)
[^skipped]: [Plugin loading reference: When the dependency install fails or is skipped](https://code.claude.com/docs/en/plugins/loading#when-the-dependency-install-fails-or-is-skipped)
