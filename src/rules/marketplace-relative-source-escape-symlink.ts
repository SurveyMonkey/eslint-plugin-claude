// A relative `source` in `marketplace.json` must not leave the marketplace
// root through a link (docs/rules/marketplace-relative-source-escape-symlink.md).
// The rule asks `sourceReader`. A link that leads out of the repository, or
// that is dangling, is unreadable there, so the rule makes no report for it
// (ADR 001, Decision 14).
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember, pluginEntries } from '../marketplace-json.ts'
import { sourceReader } from '../marketplace-source.ts'

const name = 'marketplace-relative-source-escape-symlink' as const

const rule: JSONRuleDefinition<{ MessageIds: 'escapes' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Keep a relative marketplace source inside the marketplace root',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      escapes:
        'The "source" "{{path}}" leaves the marketplace root through a link. Claude Code refuses an entry that reaches its target through a link that resolves outside the marketplace directory. Keep each link on the path inside the marketplace root.',
    },
  },
  create(context) {
    return {
      Document(node) {
        const read = sourceReader(context.filename, node)
        for (const entry of pluginEntries(node)) {
          const source = lastMember(entry, 'source')?.value
          if (source?.type === 'String' && read(entry).kind === 'escapes') {
            context.report({ node: source, messageId: 'escapes', data: { path: source.value } })
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
