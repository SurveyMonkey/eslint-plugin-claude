// A link under a plugin can have a target out of the plugin and in the same
// marketplace. A marketplace install copies that target. A local-path install
// and a `command` source in copy mode skip it
// (docs/rules/plugin-symlink-escapes-plugin.md). The rule walks the plugin on
// disk with `escapingLinks`. It reports each link that stays in the marketplace
// root and leaves the plugin. A link that leaves the marketplace is for
// `plugin-symlink-escapes-marketplace`, so one link gets one report.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { escapingLinks } from '../plugin-links.ts'
import { readPlugin } from '../plugin-manifest.ts'

const name = 'plugin-symlink-escapes-plugin' as const

const rule: JSONRuleDefinition<{ MessageIds: 'leaves' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Keep the target of a link under a plugin inside the plugin',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      leaves:
        'The link "{{file}}" leads to "{{target}}", out of the plugin and inside the marketplace. A marketplace install copies the target. A local-path install and a command source in copy mode skip the link. Keep the target inside the plugin, so that each install keeps it.',
    },
  },
  create(context) {
    const plugin = readPlugin(context.filename)
    return {
      Document(node) {
        if (plugin === undefined) {
          return
        }
        for (const { file, reach, target } of escapingLinks(plugin)) {
          if (reach === 'marketplace') {
            context.report({ node, messageId: 'leaves', data: { file, target } })
          }
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
