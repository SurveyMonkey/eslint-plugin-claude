// A relative `source` in `marketplace.json` must name a directory that exists,
// from the marketplace root (docs/rules/marketplace-relative-source-exists.md).
// The rule reads the directory through `sourceReader`. It makes no report for
// a path that it cannot see, such as a dangling link.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember, pluginEntries } from '../marketplace-json.ts'
import { sourceReader } from '../marketplace-source.ts'

const name = 'marketplace-relative-source-exists' as const

const rule: JSONRuleDefinition<{ MessageIds: 'missing' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Name an existing directory in a relative marketplace source',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      missing:
        'The "source" "{{path}}" names a directory that does not exist. "claude plugin install" fails with "Source path does not exist". Write the path from the marketplace root, the directory that holds ".claude-plugin".',
    },
  },
  create(context) {
    return {
      Document(node) {
        const read = sourceReader(context.filename, node)
        for (const entry of pluginEntries(node)) {
          const source = lastMember(entry, 'source')?.value
          if (source?.type === 'String' && read(entry).kind === 'missing') {
            context.report({ node: source, messageId: 'missing', data: { path: source.value } })
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
