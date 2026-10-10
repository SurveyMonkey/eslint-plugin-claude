// A model setting that its model does not support (docs/rules/settings-model-capability.md). A
// heuristic, and `off` in `recommended`. The rule reads the model of the same file, and the
// versions in `src/data/models.ts`. It judges a full model ID. It judges an alias only for the
// Anthropic API, and only when the file sets no provider and does not pin the alias, because an
// alias resolves to another model on another provider. A model that the file does not set is
// the default model of the account, and the rule cannot see it.
import type { JSONRuleDefinition } from '@eslint/json'
import {
  ALIAS_FAMILIES,
  ANTHROPIC_API_ALIASES,
  alwaysAdaptive,
  alwaysThinks,
  FAMILY_ALIASES,
  hasOneMillionContext,
  type ModelVersion,
  modelVersionOf,
  pinVariableOf,
  withoutSuffix,
} from '../data/models.ts'
import { isEnvOn, PROVIDER_ENV_VARS } from '../data/settings-env.ts'
import { docsUrl } from '../docs-url.ts'
import { lastMember, type ValueNode } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-model-capability' as const

type MessageId = 'noMillion' | 'thinkingOff' | 'adaptiveOff'

const SUFFIX = '[1m]'

/** The `env` variables that hold a model, apart from the pins, which come from the families. */
const MODEL_VARIABLES = ['ANTHROPIC_MODEL', 'CLAUDE_CODE_SUBAGENT_MODEL']

/** The text of the member `key` of `object`, if it is a string. */
const textOf = (object: ValueNode | undefined, key: string) => {
  const value = lastMember(object, key)?.value
  return value?.type === 'String' ? value.value : undefined
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not set a model option that the model of the file does not support',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      noMillion:
        'The model "{{value}}" has no 1M context window, so the "[1m]" suffix has no effect. Use a model with 1M context, or remove the suffix.',
      thinkingOff:
        '"{{setting}}" turns thinking off, and Claude Code ignores it on "{{model}}", which always thinks. Remove it, or choose a model that accepts it.',
      adaptiveOff:
        'Claude Code ignores "CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING" on "{{model}}", which always uses adaptive reasoning. Remove it, or choose a model that accepts it.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const body = node.body
        const env = lastMember(body, 'env')?.value

        /** Report a `[1m]` suffix on a model ID that has no 1M window. */
        const checkSuffix = (value: ValueNode | undefined) => {
          if (value?.type !== 'String' || !value.value.endsWith(SUFFIX)) {
            return
          }
          const model = modelVersionOf(value.value)
          if (model !== undefined && !hasOneMillionContext(model)) {
            context.report({ node: value, messageId: 'noMillion', data: { value: value.value } })
          }
        }
        checkSuffix(lastMember(body, 'model')?.value)
        checkSuffix(lastMember(body, 'fallbackModel')?.value)
        const available = lastMember(body, 'availableModels')?.value
        if (available?.type === 'Array') {
          for (const entry of available.elements) {
            checkSuffix(entry.value)
          }
        }
        for (const variable of [...MODEL_VARIABLES, ...FAMILY_ALIASES.map(pinVariableOf)]) {
          checkSuffix(lastMember(env, variable)?.value)
        }

        // The model of the session: `ANTHROPIC_MODEL` before the `model` setting.
        const chosen = textOf(env, 'ANTHROPIC_MODEL') || textOf(body, 'model')
        const hasProvider = PROVIDER_ENV_VARS.some((variable) => {
          const set = textOf(env, variable)
          return set !== undefined && isEnvOn(set)
        })
        /** The version of the model that `value` names, if the rule can tell. */
        const resolve = (value: string): ModelVersion | undefined => {
          const base = withoutSuffix(value)
          if (!ALIAS_FAMILIES.has(base)) {
            return modelVersionOf(value)
          }
          // An alias that the file pins is the pinned model. `best` and `opusplan` name two
          // models, and have no pin variable of their own, so the rule cannot tell.
          const pin = textOf(env, pinVariableOf(base))
          if (pin) {
            return modelVersionOf(pin)
          }
          return hasProvider ? undefined : ANTHROPIC_API_ALIASES.get(base)
        }
        if (!chosen) {
          return
        }
        const model = resolve(chosen)
        if (model === undefined) {
          return
        }

        const thinking = lastMember(body, 'alwaysThinkingEnabled')?.value
        if (thinking?.type === 'Boolean' && !thinking.value && alwaysThinks(model)) {
          context.report({
            node: thinking,
            messageId: 'thinkingOff',
            data: { setting: 'alwaysThinkingEnabled', model: chosen },
          })
        }
        const budget = lastMember(env, 'MAX_THINKING_TOKENS')?.value
        if (budget?.type === 'String' && /^0+$/.test(budget.value) && alwaysThinks(model)) {
          context.report({
            node: budget,
            messageId: 'thinkingOff',
            data: { setting: 'MAX_THINKING_TOKENS', model: chosen },
          })
        }
        const adaptive = lastMember(env, 'CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING')?.value
        if (adaptive?.type === 'String' && isEnvOn(adaptive.value) && alwaysAdaptive(model)) {
          context.report({ node: adaptive, messageId: 'adaptiveOff', data: { model: chosen } })
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
