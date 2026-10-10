// An option for a token or a password sets `sensitive: true`, so that Claude Code masks the input
// and keeps the value in secure storage (docs/rules/plugin-user-config-sensitive.md). The docs name
// a token and a password only. The rule matches whole words of the key and of the `title`. It
// reads the top-level `userConfig` and the `userConfig` of each channel. It skips an option that
// sets `sensitive`, with any value. It makes no report when it cannot see the plugin.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { readPlugin } from '../plugin-manifest.ts'
import { configsOf } from './plugin-user-config-field-applicability.ts'

const name = 'plugin-user-config-sensitive' as const

// The words of the docs: "Set `"sensitive": true` for a token or password".
const SECRET_WORD = /^(?:token|password)s?$/

/** The lower case words of a key or a title. A word ends at a character that is not a letter or
 *  a digit, and at a change from lower case to upper case. `APIToken` has the words `api` and
 *  `token`. */
function wordsOf(text: string): string[] {
  return text
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z\d]+/)
}

const rule: JSONRuleDefinition<{ MessageIds: 'sensitive' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Set sensitive on a userConfig option for a token or a password',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      sensitive:
        'The option "{{option}}" looks like a token or a password. Set `"sensitive": true`, so that Claude Code masks the input and keeps the value in secure storage.',
    },
  },
  create(context) {
    const plugin = readPlugin(context.filename)
    return {
      Document(node) {
        if (plugin === undefined) {
          return
        }
        for (const config of configsOf(node.body)) {
          for (const option of config.members) {
            if (option.value.type !== 'Object' || lastMember(option.value, 'sensitive')) {
              continue
            }
            const title = lastMember(option.value, 'title')?.value
            const words = [
              ...wordsOf(keyOf(option.name)),
              ...(title?.type === 'String' ? wordsOf(title.value) : []),
            ]
            if (words.some((word) => SECRET_WORD.test(word))) {
              context.report({
                node: option.name,
                messageId: 'sensitive',
                data: { option: keyOf(option.name) },
              })
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
