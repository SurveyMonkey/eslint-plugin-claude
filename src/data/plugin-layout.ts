// The default locations of the components of a plugin, under the plugin root.
// Source: the "Standard layout" table of the manifest reference
// (https://code.claude.com/docs/en/plugins/manifest-reference#standard-layout),
// checked on Claude Code 2.1.296 on 2026-10-10. Review this list on or before
// 2027-04-10, the `stale_after` date of docs/rules/plugin-manifest-location.md.
// The second list is the "How each key combines with its default location"
// section (https://code.claude.com/docs/en/plugins/manifest-reference#how-each-key-combines-with-its-default-location).
// The third list is the "Default settings" section of the components page
// (https://code.claude.com/docs/en/plugins/components#default-settings), checked on Claude Code
// 2.1.296 on 2026-10-10.
// The fourth list is the Type column of the "Fields" table of the manifest reference
// (https://code.claude.com/docs/en/plugins/manifest-reference#fields), checked on Claude Code
// 2.1.296 on 2026-10-10.
// The fifth list is the table of the "commands" section of the manifest reference
// (https://code.claude.com/docs/en/plugins/manifest-reference#commands), checked on Claude Code
// 2.1.296 on 2026-10-10.
// The sixth list is the table of the "User configuration" section of the manifest reference
// (https://code.claude.com/docs/en/plugins/manifest-reference#user-configuration), checked on
// Claude Code 2.1.296 on 2026-10-10.
// The manifest and `scripts/` are not in the first list. The manifest has its own place, and
// `scripts/` is a folder of the plugin author, not a default location.

/** The first part of the default location of each component, in name order:
 *  `.lsp.json`, `.mcp.json`, `agents`, `bin`, `commands`, `hooks`, `monitors`,
 *  `output-styles`, `settings.json`, `skills`, `themes` and `workflows`. */
export const PLUGIN_COMPONENT_NAMES: readonly string[] = [
  '.lsp.json',
  '.mcp.json',
  'agents',
  'bin',
  'commands',
  'hooks',
  'monitors',
  'output-styles',
  'settings.json',
  'skills',
  'themes',
  'workflows',
]

/** A manifest key that replaces a default folder. `key` is the path of the key
 *  in the manifest, and `folder` is the default folder. The key `skills` adds to
 *  its default and the keys `hooks`, `mcpServers` and `lspServers` merge with
 *  theirs, so they are not here. The default of `experimental.monitors` is
 *  the file `monitors/monitors.json`, in the folder `monitors/`. */
export const REPLACED_DEFAULTS: readonly {
  readonly key: readonly string[]
  readonly folder: string
}[] = [
  { key: ['commands'], folder: 'commands' },
  { key: ['agents'], folder: 'agents' },
  { key: ['outputStyles'], folder: 'output-styles' },
  { key: ['workflows'], folder: 'workflows' },
  { key: ['experimental', 'themes'], folder: 'themes' },
  { key: ['experimental', 'monitors'], folder: 'monitors' },
]

/** The settings keys that take effect when a plugin sets them, in a root
 *  `settings.json` or in the manifest key `settings`. Claude Code drops every
 *  other key. */
export const PLUGIN_SETTINGS_KEYS: readonly string[] = ['agent', 'subagentStatusLine']

/** A manifest key whose value names component paths. `key` is the path of the key in the
 *  manifest. `map` is true for `commands`, whose object map names a path in the `source` of each
 *  entry. The list holds the component keys of the Fields table, with the Type "Path" in whole
 *  or in part. `types` has that Type too, but it names a `.d.ts` file of a mod, not a component.
 *  `experimental.evals` names a directory that is not a component path (manifest reference,
 *  "Path rules"). The top-level `themes` and `monitors` keys still load, with a validate warning
 *  (Fields table, `experimental.themes`). */
export const PLUGIN_PATH_KEYS: readonly {
  readonly key: readonly string[]
  readonly map: boolean
}[] = [
  { key: ['skills'], map: false },
  { key: ['commands'], map: true },
  { key: ['agents'], map: false },
  { key: ['hooks'], map: false },
  { key: ['mcpServers'], map: false },
  { key: ['lspServers'], map: false },
  { key: ['outputStyles'], map: false },
  { key: ['workflows'], map: false },
  { key: ['experimental', 'themes'], map: false },
  { key: ['experimental', 'monitors'], map: false },
  { key: ['themes'], map: false },
  { key: ['monitors'], map: false },
]

/** The fields of an entry in the object map of `commands`, in the order of the table. */
export const PLUGIN_COMMAND_FIELDS: readonly string[] = [
  'source',
  'content',
  'description',
  'argumentHint',
  'model',
  'allowedTools',
]

/** The values of `type` in a `userConfig` option, in the order of the table. */
export const USER_CONFIG_TYPES: readonly string[] = [
  'string',
  'number',
  'boolean',
  'directory',
  'file',
]
