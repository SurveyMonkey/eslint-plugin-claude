// The `agent` key of the default settings of a plugin runs one of the plugin's own agents as the
// main thread (docs/rules/plugin-settings-agent-exists.md). The settings are in a root
// `settings.json` or in the manifest key `settings`. The rule lists the agents of the plugin with
// `pluginAgents`, as `skill-agent-exists` does. It makes no report when it cannot see the plugin,
// the file or the agents.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { BUILT_IN_AGENTS } from '../data/agent-fields.ts'
import { PLUGIN_SETTINGS_KEYS } from '../data/plugin-layout.ts'
import { docsUrl } from '../docs-url.ts'
import { enclosingMarketplace, entriesIn } from '../marketplace-file.ts'
import { lastMember } from '../marketplace-json.ts'
import { lookup, type Plugin, readListedPluginAt, readPlugin } from '../plugin-manifest.ts'
import { hasManifest } from '../plugin-root.ts'
import { readJson, UNREADABLE } from '../skill-tree.ts'
import { pluginAgents } from './skill-agent-exists.ts'

const name = 'plugin-settings-agent-exists' as const

/** True when the root `settings.json` of `plugin` sets a supported key, or the rule cannot read
 *  it to an object. Claude Code then applies the file and ignores the manifest key `settings`, so
 *  the manifest agent has no effect, or the rule cannot tell. */
function fileDecides(plugin: Plugin): boolean {
  const file = readJson(path.join(plugin.root, 'settings.json'), plugin.bound)
  if (file === null) {
    return false
  }
  // A file that cannot be read has no data, so it decides, as a file that is not an object does.
  const data = file === UNREADABLE ? undefined : file.data
  return (
    data === null ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    PLUGIN_SETTINGS_KEYS.some((key) => Object.hasOwn(data, key))
  )
}

/** True when an entry of the enclosing `marketplace.json` for `pluginName` sets `agents`. Claude
 *  Code adds the agents of the entry to the plugin when it has a `plugin.json`, so the
 *  rule cannot list them (marketplace reference, "Strict mode"). The rule reads the enclosing
 *  `marketplace.json` only. With none, or one that it cannot read, it sees no entry. */
function entryAddsAgents(plugin: Plugin, pluginName: string): boolean {
  const marketplace = enclosingMarketplace(plugin)
  const entries = marketplace === undefined ? undefined : entriesIn(marketplace)
  return (
    entries?.some((entry) => entry.name === pluginName && Object.hasOwn(entry, 'agents')) === true
  )
}

const rule: JSONRuleDefinition<{ MessageIds: 'missing' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Name an agent of the plugin in the agent setting of its default settings',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      missing:
        "`{{agent}}` is not a built-in agent, and no file in `agents/` of this plugin defines it. The `agent` key runs one of the plugin's own agents.",
    },
  },
  create(context) {
    const file = path.resolve(context.filename)
    const manifest = path.basename(file) === 'plugin.json'
    // Claude Code reads `.claude/settings.json` as project settings, so `settings-agent-exists`
    // owns its `agent` key (#380).
    if (!manifest && path.basename(path.dirname(file)) === '.claude') {
      return {}
    }
    const plugin = manifest ? readPlugin(file) : readListedPluginAt(path.dirname(file))
    return {
      Document(node) {
        const settings = manifest ? lastMember(node.body, 'settings')?.value : node.body
        const agent = lastMember(settings, 'agent')?.value
        // The `agents` key replaces the scan of `agents/`, and the rule cannot read it.
        if (
          plugin === undefined ||
          agent?.type !== 'String' ||
          agent.value === '' ||
          'agents' in plugin.fields ||
          (manifest && fileDecides(plugin))
        ) {
          return
        }
        // The name of the plugin is the `name` of the manifest. With no `name`, the rule guesses the
        // folder name. With no `plugin.json`, the name is the entry name, and the skip below applies.
        const pluginName =
          typeof plugin.fields.name === 'string' ? plugin.fields.name : path.basename(plugin.root)
        // The docs do not say if Claude Code compares names with case.
        const wanted = agent.value.toLowerCase()
        const same = (other: string) => other.toLowerCase() === wanted
        // A scoped name holds `:`. One that does not start with this plugin names another plugin.
        // With no `plugin.json`, the entry name is the plugin name, and the rule does not read it.
        // So the rule cannot tell which plugin a scoped name names.
        if (
          wanted.includes(':') &&
          (!wanted.startsWith(`${pluginName.toLowerCase()}:`) || hasManifest(plugin.root) !== true)
        ) {
          return
        }
        if (BUILT_IN_AGENTS.some(same)) {
          return
        }
        // A link with no target, or a part with a real path out of the repository, can hold the agent.
        if (lookup(plugin, './agents') === undefined) {
          return
        }
        if (entryAddsAgents(plugin, pluginName)) {
          return
        }
        const agents = pluginAgents(plugin.root, pluginName, plugin.bound)
        if (!agents.unseen && !agents.names.some(same)) {
          context.report({ node: agent, messageId: 'missing', data: { agent: agent.value } })
        }
      },
    }
  },
}

export const target = {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/plugin.json', '**/settings.json'],
}

export default rule
