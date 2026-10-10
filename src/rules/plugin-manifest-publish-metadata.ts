// A plugin that is ready to publish sets `homepage` and `repository` in `plugin.json` and has a
// `README.md` at the plugin root (docs/rules/plugin-manifest-publish-metadata.md). The rule makes
// one report that lists what is missing. It makes no report when it cannot see the README.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { isPluginFile, isSkillsPlugin, readPlugin } from '../plugin-manifest.ts'

const name = 'plugin-manifest-publish-metadata' as const

/** The names in `items` as one text: "a", "a and b", or "a, b and c". */
function list(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

const rule: JSONRuleDefinition<{ MessageIds: 'missing' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Set homepage and repository in plugin.json, and add a README.md to the plugin',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      missing:
        'The plugin is missing {{missing}}. Before you release, set `homepage` and `repository` in `plugin.json`, and add a `README.md` at the plugin root.',
    },
  },
  create(context) {
    const plugin = readPlugin(context.filename)
    return {
      Document(node) {
        // Claude Code loads a plugin in `.claude/skills/` in place, so nobody publishes it.
        if (plugin === undefined || isSkillsPlugin(context.filename)) {
          return
        }
        const missing = ['homepage', 'repository']
          .filter((key) => {
            const value = lastMember(node.body, key)?.value
            // A value that is not a string is a type error for `claude plugin validate`.
            return value === undefined || (value.type === 'String' && value.value.trim() === '')
          })
          .map((key) => `\`${key}\``)
        if (isPluginFile(plugin, 'README.md') === false) {
          missing.push('`README.md`')
        }
        if (missing.length > 0) {
          context.report({ node, messageId: 'missing', data: { missing: list(missing) } })
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
