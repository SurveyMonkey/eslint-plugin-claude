// The plugin source types of a marketplace entry. Source: the marketplace
// reference, "Plugin sources"
// (https://code.claude.com/docs/en/plugins/marketplace-reference#plugin-sources),
// checked on Claude Code 2.1.288. Review this list on or before 2027-04-06,
// the `stale_after` date of docs/rules/marketplace-command-version-ignored.md.
// A relative path is a plugin source too. It is a string, not an object.

/** The `source` value of each object plugin source, by name. A rule reads one
 *  type as `PLUGIN_SOURCE_TYPES.command`. `Object.values` gives the list. */
export const PLUGIN_SOURCE_TYPES = {
  github: 'github',
  url: 'url',
  gitSubdir: 'git-subdir',
  npm: 'npm',
  archive: 'archive',
  command: 'command',
} as const

// The marketplace source types. Source: the marketplace reference, "Marketplace
// sources"
// (https://code.claude.com/docs/en/plugins/marketplace-reference#marketplace-sources),
// read on 2026-10-08. Review these lists on or before 2027-04-08, the
// `stale_after` date of docs/rules/settings-extra-known-marketplaces-schema.md.
// A marketplace source says where Claude Code fetches a `marketplace.json`.
// The names `url`, `git` and `github` mean other things than in a plugin source.

/** The `source` value of each marketplace source that `extraKnownMarketplaces`
 *  loads. `Object.values` gives the list. */
export const MARKETPLACE_SOURCE_TYPES = {
  github: 'github',
  git: 'git',
  url: 'url',
  file: 'file',
  directory: 'directory',
  settings: 'settings',
} as const

/** The marketplace source types that `extraKnownMarketplaces` does not load.
 *  The docs give `npm` its own failure message, `NPM marketplace sources not
 *  yet implemented`. The other three fail with `Unsupported marketplace source
 *  type`, because they are valid only in `strictKnownMarketplaces` and
 *  `blockedMarketplaces`. (`skills-dir` is also a reserved marketplace name.) */
export const UNLOADED_MARKETPLACE_SOURCE_TYPES = {
  npm: 'npm',
  skillsDir: 'skills-dir',
  hostPattern: 'hostPattern',
  pathPattern: 'pathPattern',
} as const
