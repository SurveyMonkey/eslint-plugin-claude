// Claude Code refuses to install a `command` source with `"mode": "link"` on
// Windows (docs/rules/marketplace-command-link-mode.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { PLUGIN_SOURCE_TYPES } from '../data/marketplace-source-types.ts'
import { docsUrl } from '../docs-url.ts'
import { lastMember, pluginEntries } from '../marketplace-json.ts'

const name = 'marketplace-command-link-mode' as const

const rule: JSONRuleDefinition<{ MessageIds: 'link' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not use link mode in a command plugin source',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      link: 'The "command" source sets "mode" to "link". Claude Code refuses to install it on Windows. Use "copy" there.',
    },
  },
  create(context) {
    return {
      Document(node) {
        for (const entry of pluginEntries(node)) {
          // A `source` or `mode` of the wrong type is for `marketplace-schema` and
          // `marketplace-source-schema`.
          const source = lastMember(entry, 'source')?.value
          const type = lastMember(source, 'source')?.value
          const mode = lastMember(source, 'mode')?.value
          if (
            type?.type === 'String' &&
            type.value === PLUGIN_SOURCE_TYPES.command &&
            mode?.type === 'String' &&
            mode.value === 'link'
          ) {
            context.report({ node: mode, messageId: 'link' })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/marketplace.json'],
  rule,
}
