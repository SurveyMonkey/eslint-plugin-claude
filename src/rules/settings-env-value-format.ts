// The `env` block of a settings file: an object of string values, and the forms of the
// values of known variables (docs/rules/settings-env-value-format.md). The forms are in
// `src/data/settings-env.ts`.
import type { JSONRuleDefinition } from '@eslint/json'
import { envValueForm } from '../data/settings-env.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember, type ValueNode } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-env-value-format' as const

const TYPE_OF: Record<ValueNode['type'], string> = {
  String: 'a string',
  Number: 'a number',
  Infinity: 'a number',
  NaN: 'a number',
  Boolean: 'a Boolean',
  Null: 'null',
  Object: 'an object',
  Array: 'an array',
}

const rule: JSONRuleDefinition<{
  RuleOptions: []
  MessageIds: 'envNotObject' | 'notString' | 'badForm'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write the env block of a settings file as an object of string values',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      envNotObject:
        'Claude Code reads "env" as an object of variable names and string values, not {{type}}.',
      notString: 'The value of "{{name}}" must be a string, not {{type}}.',
      badForm: 'The value of "{{name}}" must be {{expected}}.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const env = lastMember(node.body, 'env')?.value
        if (env === undefined) {
          return
        }
        if (env.type !== 'Object') {
          context.report({
            node: env,
            messageId: 'envNotObject',
            data: { type: TYPE_OF[env.type] },
          })
          return
        }
        for (const member of env.members) {
          const variable = keyOf(member.name)
          const { value } = member
          // Two keys of one name: the last counts, as in `JSON.parse`.
          if (lastMember(env, variable) !== member) {
            continue
          }
          if (value.type !== 'String') {
            context.report({
              node: value,
              messageId: 'notString',
              data: { name: variable, type: TYPE_OF[value.type] },
            })
            continue
          }
          const form = envValueForm(variable)
          if (value.value !== '' && form !== undefined && !form.accepts(value.value)) {
            context.report({
              node: value,
              messageId: 'badForm',
              data: { name: variable, expected: form.expected },
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
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}
