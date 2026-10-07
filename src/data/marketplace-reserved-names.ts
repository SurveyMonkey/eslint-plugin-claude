// The marketplace names that Claude Code reserves. Source: the marketplace
// reference, "Reserved names"
// (https://code.claude.com/docs/en/plugins/marketplace-reference#reserved-names),
// checked on Claude Code 2.1.288. Review these lists on or before 2027-04-06,
// the `stale_after` date of docs/rules/marketplace-name-reserved.md.

/** The official, community and plugin directory names. Claude Code reserves
 *  them unless the marketplace comes from a `github` or `git` source under
 *  `github.com/anthropics/`. */
export const ANTHROPIC_MARKETPLACE_NAMES: readonly string[] = [
  // Official marketplace names.
  'claude-code-marketplace',
  'claude-code-plugins',
  'claude-plugins-official',
  'anthropic-marketplace',
  'anthropic-plugins',
  'agent-skills',
  'anthropic-agent-skills',
  'life-sciences',
  'knowledge-work-plugins',
  'claude-for-legal',
  'claude-for-financial-services',
  'financial-services-plugins',
  'first-party-plugins',
  'claude-tag-plugins',
  // Community marketplace names.
  'claude-community',
  'claude-plugins-community',
  'healthcare',
  // Plugin directory names.
  'anthropic-plugin-directory',
  'claude-plugin-directory',
]

/** The names that Claude Code uses for plugins that do not come from a
 *  marketplace, and the test name. No marketplace can use them. */
export const INTERNAL_MARKETPLACE_NAMES: readonly string[] = [
  'inline',
  'builtin',
  'skills-dir',
  'synced',
  'claude-plugin-test',
]

/** The package-manager names. Claude Code reserves them in any letter case. */
export const PACKAGE_MANAGER_NAMES: readonly string[] = [
  'npm',
  'pip',
  'uv',
  'cargo',
  'github',
  'gh',
]

/** Claude Code reserves each name that starts with this prefix for
 *  marketplaces that claude.ai hosts. */
export const CLAUDEAI_PREFIX = 'claudeai-'
