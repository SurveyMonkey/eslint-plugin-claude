// Claude Code derives the version of a `command` source from the output of the
// command. It ignores the `version` of the entry
// (docs/rules/marketplace-command-version-ignored.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { COMMAND_SOURCE_TYPE } from '../data/marketplace-source-types.ts'
import { docsUrl } from '../docs-url.ts'
import { lastMember, pluginEntries } from '../marketplace-json.ts'

const name = 'marketplace-command-version-ignored' as const

const rule: JSONRuleDefinition<{ MessageIds: 'ignored' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not set the version of an entry with a command source',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      ignored:
        'The entry has a command source, so Claude Code ignores its "version". Claude Code derives the version from the command output.',
    },
  },
  create(context) {
    return {
      Document(node) {
        for (const entry of pluginEntries(node)) {
          // A `source` that is not an object with a string type is for `marketplace-schema`.
          const type = lastMember(lastMember(entry, 'source')?.value, 'source')?.value
          const version = lastMember(entry, 'version')
          if (
            type?.type === 'String' &&
            type.value === COMMAND_SOURCE_TYPE &&
            version?.value.type === 'String'
          ) {
            context.report({ node: version, messageId: 'ignored' })
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
