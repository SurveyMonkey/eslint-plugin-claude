// The default locations of the components of a plugin, under the plugin root.
// Source: the "Standard layout" table of the manifest reference
// (https://code.claude.com/docs/en/plugins/manifest-reference#standard-layout),
// checked on Claude Code 2.1.296 on 2026-10-10. Review this list on or before
// 2027-04-10, the `stale_after` date of docs/rules/plugin-manifest-location.md.
// The manifest and `scripts/` are not here. The manifest has its own place, and
// `scripts/` is a folder of the plugin author, not a default location.

/** The first part of the default location of each component, in name order:
 *  `skills/`, `commands/`, `agents/`, `hooks/hooks.json`, `.mcp.json`,
 *  `.lsp.json`, `output-styles/`, `workflows/`, `themes/`,
 *  `monitors/monitors.json`, `bin/` and `settings.json`. */
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
