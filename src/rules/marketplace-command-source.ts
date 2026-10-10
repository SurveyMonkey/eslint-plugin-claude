// A `command` source runs a shell command on the machine of the user, at
// install, at update, and once for each session. The rule reports each one for
// review (docs/rules/marketplace-command-source.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { PLUGIN_SOURCE_TYPES } from '../data/marketplace-source-types.ts'
import { docsUrl } from '../docs-url.ts'
import { lastMember, pluginEntries } from '../marketplace-json.ts'

const name = 'marketplace-command-source' as const

const rule: JSONRuleDefinition<{ MessageIds: 'review' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Review each command plugin source',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      review:
        'The entry has a "command" source. Claude Code runs its command on the machine of the user, at install, at update, and once for each session. Review the command.',
    },
  },
  create(context) {
    return {
      Document(node) {
        for (const entry of pluginEntries(node)) {
          // A `source` that is not an object with a string `source` is for `marketplace-schema`
          // and `marketplace-source-schema`.
          const source = lastMember(entry, 'source')?.value
          const type = lastMember(source, 'source')?.value
          if (type?.type === 'String' && type.value === PLUGIN_SOURCE_TYPES.command) {
            context.report({ node: type, messageId: 'review' })
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
