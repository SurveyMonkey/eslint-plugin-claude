// An entry in `marketplace.json` with `"strict": false` must not declare a
// component field when its relative source has a `plugin.json`. The plugin
// fails to load (docs/rules/marketplace-strict-false-conflict.md). The rule
// reads `plugin.json` through `sourceReader`, and makes no report when it
// cannot read it.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember, pluginEntries } from '../marketplace-json.ts'
import { sourceReader } from '../marketplace-source.ts'

const name = 'marketplace-strict-false-conflict' as const

// The six component fields of an entry (marketplace reference, "Strict mode").
const COMPONENT_FIELDS = ['commands', 'agents', 'skills', 'hooks', 'outputStyles', 'themes']

const rule: JSONRuleDefinition<{ MessageIds: 'conflict' }> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Declare no component field in an entry with strict set to false when the source has a plugin.json',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      conflict:
        'The entry sets "strict": false and "{{field}}", and its source has a plugin.json. The plugin fails to load with a conflict of manifests. Remove "{{field}}" from the entry, or remove "strict": false.',
    },
  },
  create(context) {
    return {
      Document(node) {
        const read = sourceReader(context.filename, node)
        for (const entry of pluginEntries(node)) {
          // A `strict` that is not a boolean is for `marketplace-schema`.
          const strict = lastMember(entry, 'strict')?.value
          if (strict?.type !== 'Boolean' || strict.value) {
            continue
          }
          const members = COMPONENT_FIELDS.flatMap((field) => {
            const member = lastMember(entry, field)
            return member === undefined ? [] : [{ field, member }]
          })
          // The read comes after the key tests, so an entry with none of the keys costs no read.
          if (members.length > 0 && read(entry).kind === 'manifest') {
            for (const { field, member } of members) {
              context.report({ node: member, messageId: 'conflict', data: { field } })
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
