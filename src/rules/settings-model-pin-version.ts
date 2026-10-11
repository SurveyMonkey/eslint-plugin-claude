// A model value in a settings file that moves with the Claude Code release
// (docs/rules/settings-model-pin-version.md). A heuristic, and `off` in `recommended`. The shared
// project file should name the model it means. An alias moves to a newer model over time, unless
// the same file pins it with `ANTHROPIC_DEFAULT_*_MODEL`. On Amazon Bedrock, an `availableModels`
// entry that is an Anthropic model ID does not match the provider-form ID that the session
// runs. The data is in `src/data/models.ts`. `settings-model-value` owns the values that are not
// models, and the pin variables that hold an alias.
import type { JSONRuleDefinition } from '@eslint/json'
import { ALIAS_FAMILIES, isAnthropicModelId, pinVariableOf, withoutSuffix } from '../data/models.ts'
import { isEnvOn } from '../data/settings-env.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember, type ValueNode } from '../marketplace-json.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-model-pin-version' as const

/** The text of the member `key` of `object`, if it is a string. */
const textOf = (object: ValueNode | undefined, key: string) => {
  const value = lastMember(object, key)?.value
  return value?.type === 'String' ? value.value : undefined
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'alias' | 'noPrefix' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Pin the model of the shared settings file to a version',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      alias:
        'The model "{{value}}" is an alias, and an alias moves to a newer model over time. Name a full model ID, or pin the alias in "env" with "{{pin}}".',
      noPrefix:
        'The entry "{{entry}}" of "availableModels" is an Anthropic model ID. On Amazon Bedrock, Claude Code does not strip a provider prefix such as "us.anthropic.", so the entry may not match the model of the session. List the full provider-form ID.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    const isManaged = kindOf(context.filename) === 'managed'
    return {
      Document(node) {
        const body = node.body
        const env = lastMember(body, 'env')?.value
        const model = lastMember(body, 'model')?.value
        // The managed files hold a policy. The alias is a choice of the shared project file.
        if (!isManaged && model?.type === 'String') {
          const families = ALIAS_FAMILIES.get(withoutSuffix(model.value)) ?? []
          const unpinned = families.find((family) => !textOf(env, pinVariableOf(family)))
          if (unpinned !== undefined) {
            context.report({
              node: model,
              messageId: 'alias',
              data: { value: model.value, pin: pinVariableOf(unpinned) },
            })
          }
        }

        const bedrock = textOf(env, 'CLAUDE_CODE_USE_BEDROCK')
        const models = lastMember(body, 'availableModels')?.value
        if (bedrock === undefined || !isEnvOn(bedrock) || models?.type !== 'Array') {
          return
        }
        // A `modelOverrides` key is an Anthropic model ID. The page says that Claude Code compares
        // the allowlist with the Anthropic ID of an overridden model.
        const overrides = lastMember(body, 'modelOverrides')?.value
        const overridden = new Set(
          overrides?.type === 'Object' ? overrides.members.map((member) => keyOf(member.name)) : [],
        )
        for (const { value } of models.elements) {
          if (
            value.type === 'String' &&
            isAnthropicModelId(withoutSuffix(value.value)) &&
            !overridden.has(withoutSuffix(value.value))
          ) {
            context.report({ node: value, messageId: 'noPrefix', data: { entry: value.value } })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude/settings.json', ...MANAGED_SETTINGS_FILES],
  rule,
}
