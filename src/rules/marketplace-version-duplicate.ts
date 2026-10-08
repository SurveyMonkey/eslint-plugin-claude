// An entry in `marketplace.json` and the `plugin.json` of its relative source
// must not both set a `version` (docs/rules/marketplace-version-duplicate.md).
// The rule reads `plugin.json` through `sourceReader`, and makes no report
// when it cannot read it. An empty string is not a version.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember, pluginEntries } from '../marketplace-json.ts'
import { sourceReader } from '../marketplace-source.ts'

const name = 'marketplace-version-duplicate' as const

const rule: JSONRuleDefinition<{ MessageIds: 'differs' | 'same' }> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Set the version of a marketplace plugin in the entry or in plugin.json, not both',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      differs:
        'The entry sets "version" to "{{entry}}", and the plugin.json of its source sets it to "{{manifest}}". Claude Code uses the plugin.json value and ignores the entry value. Set the version in one place.',
      same: 'The entry sets "version" to "{{entry}}", and the plugin.json of its source sets the same value. Claude Code uses the plugin.json value, so a change to the entry alone has no effect. Set the version in one place.',
    },
  },
  create(context) {
    return {
      Document(node) {
        const read = sourceReader(context.filename, node)
        for (const entry of pluginEntries(node)) {
          // A version that is not a string is for `marketplace-schema`.
          const value = lastMember(entry, 'version')?.value
          if (value?.type !== 'String' || value.value === '') {
            continue
          }
          const source = read(entry)
          const manifest = source.kind === 'manifest' ? source.manifest.version : undefined
          if (typeof manifest === 'string' && manifest !== '') {
            context.report({
              node: value,
              messageId: manifest === value.value ? 'same' : 'differs',
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
