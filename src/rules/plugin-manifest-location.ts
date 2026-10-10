// Claude Code loads no component from `.claude-plugin/`. Only `plugin.json`
// belongs there, and `marketplace.json` for a marketplace
// (docs/rules/plugin-manifest-location.md). The rule lists the components that
// it finds in that directory, from the manifest of a plugin. It makes no report
// when it cannot see the plugin or the directory.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { PLUGIN_COMPONENT_NAMES } from '../data/plugin-layout.ts'
import { docsUrl } from '../docs-url.ts'
import { readPlugin } from '../plugin-manifest.ts'
import { entriesOf } from '../skill-tree.ts'

const name = 'plugin-manifest-location' as const

const rule: JSONRuleDefinition<{ MessageIds: 'misplaced' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Keep the components of a plugin out of .claude-plugin/',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      misplaced:
        'Claude Code does not load components from `.claude-plugin/`: {{names}}. Only `plugin.json` and `marketplace.json` belong there. Move each component to the plugin root.',
    },
  },
  create(context) {
    const plugin = readPlugin(context.filename)
    return {
      Document(node) {
        if (plugin === undefined) {
          return
        }
        const entries = entriesOf(path.join(plugin.root, '.claude-plugin'))
        const found = Array.isArray(entries)
          ? entries
              .map((entry) => entry.name)
              .filter((entry) => PLUGIN_COMPONENT_NAMES.includes(entry))
          : []
        if (found.length > 0) {
          const names = found
            .sort()
            .map((entry) => `\`${entry}\``)
            .join(', ')
          context.report({ node, messageId: 'misplaced', data: { names } })
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
