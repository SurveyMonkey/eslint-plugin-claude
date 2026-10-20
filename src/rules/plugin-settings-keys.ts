// A plugin sets default settings in a root `settings.json` or in the manifest key `settings`. Two
// keys take effect, and Claude Code drops every other key (docs/rules/plugin-settings-keys.md).
// The rule reports each top-level key that Claude Code drops. It finds the plugin as
// `plugin-settings-agent-exists` does, and makes no report when it cannot see the plugin.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { PLUGIN_SETTINGS_KEYS } from '../data/plugin-layout.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { readListedPluginAt, readPlugin } from '../plugin-manifest.ts'

const name = 'plugin-settings-keys' as const

const rule: JSONRuleDefinition<{ MessageIds: 'unsupported' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Set only the keys that take effect in the default settings of a plugin',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unsupported: `Claude Code drops \`{{key}}\` from the default settings of a plugin. Only ${PLUGIN_SETTINGS_KEYS.map((key) => `\`${key}\``).join(' and ')} take effect.`,
    },
  },
  create(context) {
    const file = path.resolve(context.filename)
    const manifest = path.basename(file) === 'plugin.json'
    // Claude Code reads `.claude/settings.json` as project settings, so the settings rules own it.
    if (!manifest && path.basename(path.dirname(file)) === '.claude') {
      return {}
    }
    const plugin = manifest ? readPlugin(file) : readListedPluginAt(path.dirname(file))
    return {
      Document(node) {
        const settings = manifest ? lastMember(node.body, 'settings')?.value : node.body
        // A value that is not an object sets no key. `claude plugin validate` fails it in a manifest.
        if (plugin === undefined || settings?.type !== 'Object') {
          return
        }
        // A map keeps the last member of each key, as `JSON.parse` does.
        const members = new Map(settings.members.map((member) => [keyOf(member.name), member]))
        for (const [key, member] of members) {
          if (!PLUGIN_SETTINGS_KEYS.includes(key)) {
            context.report({ node: member.name, messageId: 'unsupported', data: { key } })
          }
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
