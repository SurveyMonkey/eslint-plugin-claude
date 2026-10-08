// The `name` of an entry in `marketplace.json` must equal the `name` in the
// `plugin.json` of its relative source
// (docs/rules/marketplace-entry-name-matches-manifest.md). The rule reads that
// file through `sourceReader`, and makes no report when it cannot read it.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember, pluginEntries } from '../marketplace-json.ts'
import { sourceReader } from '../marketplace-source.ts'

const name = 'marketplace-entry-name-matches-manifest' as const

const rule: JSONRuleDefinition<{ MessageIds: 'mismatch' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Keep the name of a marketplace entry the same as the name in its plugin.json',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      mismatch:
        'The entry "name" is "{{entry}}", and the "name" in the plugin.json of its source is "{{manifest}}". Users install by the entry name, and an install by the manifest name fails with "not found in marketplace". Use one name.',
    },
  },
  create(context) {
    return {
      Document(node) {
        const read = sourceReader(context.filename, node)
        for (const entry of pluginEntries(node)) {
          // A name that is not a string, or is empty, is for `marketplace-schema`.
          const value = lastMember(entry, 'name')?.value
          if (value?.type !== 'String' || value.value === '') {
            continue
          }
          const source = read(entry)
          const manifest = source.kind === 'manifest' ? source.manifest.name : undefined
          // A manifest name that is missing, empty or not a string is for the plugin manifest rules.
          if (typeof manifest === 'string' && manifest !== '' && manifest !== value.value) {
            context.report({
              node: value,
              messageId: 'mismatch',
              data: { entry: value.value, manifest },
            })
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
