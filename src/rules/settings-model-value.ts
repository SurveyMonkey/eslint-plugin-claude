// A model value in a settings file (docs/rules/settings-model-value.md). The aliases and the ID
// forms are in `src/data/models.ts`. The option `providerIdPatterns` lets a provider ID pass.
// The rule leaves two values to other rules. `settings-env-shadowed` reports
// `CLAUDE_CODE_SUBAGENT_MODEL: "inherit"` and owns `ANTHROPIC_DEFAULT_MODEL`.
import type { JSONRuleDefinition } from '@eslint/json'
import { ADVISOR_ALIASES, isModelAlias, isModelId } from '../data/models.ts'
import { docsUrl } from '../docs-url.ts'
import { lastMember, type ValueNode } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-model-value' as const

type Options = [{ providerIdPatterns: string[] }]
type MessageId = 'notModel' | 'notAdvisor' | 'alias'

/** The `env` variables that hold a model alias or a model ID. */
const MODEL_VARIABLES = ['ANTHROPIC_MODEL', 'CLAUDE_CODE_SUBAGENT_MODEL']

/** The `env` variables that pin an alias to a model. The page says each value "must be a full
 *  model name, or the equivalent identifier for your API provider". */
const PIN_VARIABLES = [
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_DEFAULT_FABLE_MODEL',
]

/** The value of `CLAUDE_CODE_SUBAGENT_MODEL` that `settings-env-shadowed` reports. */
const INHERIT = 'inherit'

/** The regular expressions of the option. A pattern that does not compile is a fault of the
 *  configuration, not of the linted file, so it stops the run with a message. */
function compile(patterns: readonly string[]): RegExp[] {
  return patterns.map((pattern) => {
    try {
      return new RegExp(pattern)
    } catch (error) {
      throw new Error(
        `The option "providerIdPatterns" of ${name} has a pattern that is not a regular expression: ${pattern}`,
        { cause: error },
      )
    }
  })
}

const rule: JSONRuleDefinition<{ RuleOptions: Options; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Set each model value to an alias or a model ID that Claude Code accepts',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { providerIdPatterns: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ providerIdPatterns: [] }],
    messages: {
      notModel: 'The value "{{value}}" of "{{key}}" is not a model alias or a "claude-" model ID.',
      notAdvisor:
        'The value "{{value}}" of "advisorModel" is not "fable", "opus", "sonnet" or a "claude-" model ID.',
      alias: 'Set "{{key}}" to a full model ID. The value "{{value}}" is an alias.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    const [{ providerIdPatterns }] = context.options
    const patterns = compile(providerIdPatterns)
    const isProviderId = (value: string) => patterns.some((pattern) => pattern.test(value))
    const isModel = (value: string) =>
      isModelAlias(value) || isModelId(value) || isProviderId(value)

    return {
      Document(node) {
        const body = node.body
        if (body.type !== 'Object') {
          return
        }

        /** Report `value` when it is a string that `accepts` does not accept. */
        const check = (
          value: ValueNode | undefined,
          key: string,
          accepts: (text: string) => boolean,
          messageId: MessageId,
        ) => {
          if (value?.type === 'String' && !accepts(value.value)) {
            context.report({ node: value, messageId, data: { key, value: value.value } })
          }
        }

        check(lastMember(body, 'model')?.value, 'model', isModel, 'notModel')
        for (const key of ['fallbackModel', 'availableModels']) {
          const list = lastMember(body, key)?.value
          if (list?.type === 'Array') {
            for (const entry of list.elements) {
              check(entry.value, key, isModel, 'notModel')
            }
          }
        }
        check(
          lastMember(body, 'advisorModel')?.value,
          'advisorModel',
          (text) => ADVISOR_ALIASES.includes(text) || isModelId(text) || isProviderId(text),
          'notAdvisor',
        )

        const env = lastMember(body, 'env')?.value
        if (env?.type !== 'Object') {
          return
        }
        // The empty string cancels a shell value, and is valid for every variable.
        for (const variable of MODEL_VARIABLES) {
          check(
            lastMember(env, variable)?.value,
            `env.${variable}`,
            (text) =>
              text === '' ||
              isModel(text) ||
              (variable === 'CLAUDE_CODE_SUBAGENT_MODEL' && text === INHERIT),
            'notModel',
          )
        }
        for (const variable of PIN_VARIABLES) {
          check(
            lastMember(env, variable)?.value,
            `env.${variable}`,
            (text) => !isModelAlias(text),
            'alias',
          )
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
