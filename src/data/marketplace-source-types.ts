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
