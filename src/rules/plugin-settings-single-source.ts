// A plugin sets its default settings in a root `settings.json` or in the manifest
// key `settings`. When both exist and the file sets a supported key, Claude Code
// applies the file and ignores the manifest (docs/rules/plugin-settings-single-source.md).
// The rule reports the manifest key. It makes no report when it cannot see the file.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { PLUGIN_SETTINGS_KEYS } from '../data/plugin-layout.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { readPlugin } from '../plugin-manifest.ts'
import { readJson, UNREADABLE } from '../skill-tree.ts'

const name = 'plugin-settings-single-source' as const

/** The supported keys among `keys`, in the order of the list. */
const supported = (keys: readonly string[]) =>
  PLUGIN_SETTINGS_KEYS.filter((key) => keys.includes(key))

const rule: JSONRuleDefinition<{ MessageIds: 'ignored' }> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Set the default settings of a plugin in settings.json or in the manifest, not both',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      ignored:
        'The plugin has a `settings.json` that sets {{keys}}. Claude Code then ignores the `settings` key of the manifest. Keep the settings in one place.',
    },
  },
  create(context) {
    const plugin = readPlugin(context.filename)
    return {
      Document(node) {
        const member = lastMember(node.body, 'settings')
        // A manifest `settings` with no supported key loses nothing, because Claude Code drops its keys.
        if (
          plugin === undefined ||
          member?.value.type !== 'Object' ||
          supported(member.value.members.map((entry) => keyOf(entry.name))).length === 0
        ) {
          return
        }
        const file = readJson(path.join(plugin.root, 'settings.json'), plugin.bound)
        if (file === null || file === UNREADABLE) {
          return
        }
        const data = file.data
        const keys =
          data !== null && typeof data === 'object' && !Array.isArray(data)
            ? supported(Object.keys(data))
            : []
        if (keys.length > 0) {
          context.report({
            node: member,
            messageId: 'ignored',
            data: { keys: keys.map((key) => `\`${key}\``).join(', ') },
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/plugin.json'],
  rule,
}
