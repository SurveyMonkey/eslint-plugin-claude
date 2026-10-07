// The plugin source types of a marketplace entry. Source: the marketplace
// reference, "Plugin sources"
// (https://code.claude.com/docs/en/plugins/marketplace-reference#plugin-sources),
// checked on Claude Code 2.1.288. Review this list on or before 2027-04-06,
// the `stale_after` date of docs/rules/marketplace-command-version-ignored.md.
// A relative path is a plugin source too. It is a string, not an object.

/** The `source` value of each object plugin source. */
export const PLUGIN_SOURCE_TYPES: readonly string[] = [
  'github',
  'url',
  'git-subdir',
  'npm',
  'archive',
  'command',
]

/** The type of a source that runs a command on the machine of the user. */
export const COMMAND_SOURCE_TYPE = 'command'
