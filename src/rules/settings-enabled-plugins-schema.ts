// The keys and values of `enabledPlugins` in a project settings file
// (docs/rules/settings-enabled-plugins-schema.md). The docs say that a key is
// `plugin-name@marketplace-name` and a value is a Boolean. The type of
// `enabledPlugins` itself is not checked.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'

const name = 'settings-enabled-plugins-schema' as const

/** True when `key` has one "@", with text on each side. */
export function keyForm(key: string): boolean {
  const parts = key.split('@')
  return parts.length === 2 && parts.every((part) => part !== '')
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'keyForm' | 'valueType' }> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Write each enabledPlugins key as plugin-name@marketplace-name with a Boolean value',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      keyForm:
        'The "enabledPlugins" key "{{key}}" must be "plugin-name@marketplace-name": one "@" with a name on each side.',
      valueType: 'The "enabledPlugins" value of "{{key}}" must be true or false.',
    },
  },
  create(context) {
    return {
      Document(node) {
        const plugins = lastMember(node.body, 'enabledPlugins')?.value
        if (plugins?.type !== 'Object') {
          return
        }
        for (const member of plugins.members) {
          const key = keyOf(member.name)
          // Two members of one key read as the last, as `JSON.parse` does.
          if (lastMember(plugins, key) !== member) {
            continue
          }
          if (!keyForm(key)) {
            context.report({ node: member.name, messageId: 'keyForm', data: { key } })
          }
          if (member.value.type !== 'Boolean') {
            context.report({ node: member.value, messageId: 'valueType', data: { key } })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: SETTINGS_FILES,
  rule,
}
