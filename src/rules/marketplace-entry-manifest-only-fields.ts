// An entry in `marketplace.json` whose relative source has a `plugin.json`
// must not set `mcpServers`, `lspServers`, `userConfig` or `channels`. They do
// not apply there (docs/rules/marketplace-entry-manifest-only-fields.md). The
// rule reads `plugin.json` through `sourceReader`, and makes no report when it
// cannot read it.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember, pluginEntries } from '../marketplace-json.ts'
import { sourceReader } from '../marketplace-source.ts'

const name = 'marketplace-entry-manifest-only-fields' as const

// The manifest fields that an entry may not set when its source has a `plugin.json`
// (marketplace reference, "How an entry combines with plugin.json").
const MANIFEST_ONLY = ['mcpServers', 'lspServers', 'userConfig', 'channels']

const rule: JSONRuleDefinition<{ MessageIds: 'ignored' }> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Declare mcpServers, lspServers, userConfig and channels in plugin.json, not in the entry',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      ignored:
        'The entry sets "{{field}}", and its source has a plugin.json, so the field does not apply. Declare "{{field}}" in plugin.json.',
    },
  },
  create(context) {
    return {
      Document(node) {
        const read = sourceReader(context.filename, node)
        for (const entry of pluginEntries(node)) {
          const members = MANIFEST_ONLY.flatMap((field) => {
            const member = lastMember(entry, field)
            return member === undefined ? [] : [{ field, member }]
          })
          // The read comes after the key test, so an entry with none of the keys costs no read.
          if (members.length > 0 && read(entry).kind === 'manifest') {
            for (const { field, member } of members) {
              context.report({ node: member, messageId: 'ignored', data: { field } })
            }
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
