// An `archive` source sets `sha256`, so that Claude Code refuses a changed
// download. The rule checks that the key is there. `marketplace-source-schema`
// checks the value (docs/rules/marketplace-archive-sha256.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { PLUGIN_SOURCE_TYPES } from '../data/marketplace-source-types.ts'
import { docsUrl } from '../docs-url.ts'
import { lastMember, pluginEntries } from '../marketplace-json.ts'

const name = 'marketplace-archive-sha256' as const

const rule: JSONRuleDefinition<{ MessageIds: 'unpinned' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Pin an archive plugin source with sha256',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unpinned:
        'The "archive" source sets no "sha256". Set it, so that Claude Code refuses a download that has changed.',
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
          if (
            source?.type === 'Object' &&
            type?.type === 'String' &&
            type.value === PLUGIN_SOURCE_TYPES.archive &&
            lastMember(source, 'sha256') === undefined
          ) {
            context.report({ node: source, messageId: 'unpinned' })
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
