// On macOS and Linux, Claude Code refuses an entry path with a backslash
// after the leading `./`. `marketplace-relative-source-format` reports each
// other path with a backslash: a network path, an absolute path, a `..`
// segment, and a path with no `./`. This rule reports the rest, so that no
// path has two reports (docs/rules/marketplace-relative-source-backslash.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember, pluginEntries } from '../marketplace-json.ts'
import { pathFault } from './marketplace-relative-source-format.ts'

const name = 'marketplace-relative-source-backslash' as const

const PREFIX = './'

const rule: JSONRuleDefinition<{ MessageIds: 'backslash' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write a relative plugin source with forward slashes',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      backslash:
        'The "source" "{{path}}" has a backslash after "./". Claude Code refuses it on macOS and Linux. Write the path with forward slashes.',
    },
  },
  create(context) {
    return {
      Document(node) {
        for (const entry of pluginEntries(node)) {
          // A `source` that is not a string is for `marketplace-schema`.
          const source = lastMember(entry, 'source')?.value
          if (source?.type !== 'String') {
            continue
          }
          const path = source.value
          if (
            pathFault(path) === undefined &&
            path.startsWith(PREFIX) &&
            path.slice(PREFIX.length).includes('\\')
          ) {
            context.report({ node: source, messageId: 'backslash', data: { path } })
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
