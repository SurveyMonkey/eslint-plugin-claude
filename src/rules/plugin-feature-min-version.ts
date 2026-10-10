// A `plugin.json` that uses a feature that needs a newer Claude Code. The
// rule reports only when the option `minVersion` is set and is older than the version that added
// the feature (docs/rules/plugin-feature-min-version.md). It makes no report when it cannot see
// the plugin.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { MIN_VERSION_SCHEMA, supportsBefore } from '../min-version.ts'
import { pathNodes, readPlugin } from '../plugin-manifest.ts'

const name = 'plugin-feature-min-version' as const

// The first version that accepts `"."` as a `skills` path.
const SKILLS_DOT = '2.1.221'
// The first version that accepts the `metadata` key.
const METADATA = '2.1.222'
// The first version that loads a plugin with `options` on a `userConfig` field.
const OPTIONS = '2.1.271'

type Options = [{ minVersion?: string }]

const rule: JSONRuleDefinition<{
  RuleOptions: Options
  MessageIds: 'skillsDot' | 'metadata' | 'options'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use no plugin.json feature that is newer than the minVersion option',
      url: docsUrl(name),
    },
    schema: [MIN_VERSION_SCHEMA],
    defaultOptions: [{}],
    messages: {
      skillsDot:
        'The `skills` path "." fails manifest validation on Claude Code before v2.1.221. Use "./" for the plugin root, or set the option `minVersion` to 2.1.221 or later.',
      metadata:
        'The `metadata` key needs Claude Code v2.1.222 or later. Remove it, or set the option `minVersion` to 2.1.222 or later.',
      options:
        'The `options` of a `userConfig` field needs Claude Code v2.1.271 or later. Before that, the plugin fails to load. Remove it, or set the option `minVersion` to 2.1.271 or later.',
    },
  },
  create(context) {
    const [{ minVersion }] = context.options
    const plugin = readPlugin(context.filename)
    if (plugin === undefined) {
      return {}
    }
    return {
      Document(node) {
        if (supportsBefore(minVersion, SKILLS_DOT)) {
          for (const path of pathNodes(lastMember(node.body, 'skills')?.value)) {
            if (path.value === '.') {
              context.report({ node: path, messageId: 'skillsDot' })
            }
          }
        }
        const metadata = lastMember(node.body, 'metadata')
        if (metadata !== undefined && supportsBefore(minVersion, METADATA)) {
          context.report({ node: metadata, messageId: 'metadata' })
        }
        const fields = lastMember(node.body, 'userConfig')?.value
        if (fields?.type === 'Object' && supportsBefore(minVersion, OPTIONS)) {
          for (const field of fields.members) {
            const options = lastMember(field.value, 'options')
            if (options !== undefined) {
              context.report({ node: options, messageId: 'options' })
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
  files: ['**/.claude-plugin/plugin.json'],
  rule,
}
