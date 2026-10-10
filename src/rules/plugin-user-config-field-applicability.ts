// In a `userConfig` option, `min` and `max` are bounds for a `number`, and `multiple` is for a
// `string` (docs/rules/plugin-user-config-field-applicability.md). The rule reads the top-level
// `userConfig` and the `userConfig` of each channel. It makes no report when it cannot see the
// plugin, and none for an option whose `type` is not one of the five in the docs, which
// `claude plugin validate` rejects.
import type { JSONRuleDefinition } from '@eslint/json'
import { USER_CONFIG_TYPES } from '../data/plugin-layout.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember, type ObjectNode, type ValueNode } from '../marketplace-json.ts'
import { readPlugin } from '../plugin-manifest.ts'

const name = 'plugin-user-config-field-applicability' as const

// The type that each field is for: "Bounds for `number`" and "For `string`, allows an array of
// strings" (manifest reference, "User configuration").
const FITS = new Map([
  ['min', 'number'],
  ['max', 'number'],
  ['multiple', 'string'],
])

/** The `userConfig` objects of a manifest body: the top-level one and one for each channel. */
function configsOf(body: ValueNode): ObjectNode[] {
  const channels = lastMember(body, 'channels')?.value
  const values = [
    lastMember(body, 'userConfig')?.value,
    ...(channels?.type === 'Array'
      ? channels.elements.map(({ value }) => lastMember(value, 'userConfig')?.value)
      : []),
  ]
  return values.flatMap((value) => (value?.type === 'Object' ? [value] : []))
}

const rule: JSONRuleDefinition<{ MessageIds: 'bound' | 'multiple' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Set min, max and multiple only on the userConfig option types they fit',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      bound:
        '`{{field}}` sets a bound for a `number` option. The option "{{option}}" has `type: {{type}}`.',
      multiple:
        '`multiple` is a field of a `string` option. The option "{{option}}" has `type: {{type}}`.',
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
            const type = lastMember(option.value, 'type')?.value
            if (
              option.value.type !== 'Object' ||
              type?.type !== 'String' ||
              !USER_CONFIG_TYPES.includes(type.value)
            ) {
              continue
            }
            for (const member of option.value.members) {
              const field = keyOf(member.name)
              if (FITS.has(field) && FITS.get(field) !== type.value) {
                context.report({
                  node: member.name,
                  messageId: field === 'multiple' ? 'multiple' : 'bound',
                  data: { field, option: keyOf(option.name), type: type.value },
                })
              }
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
