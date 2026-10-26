// `env.CLAUDE_CODE_AUTO_MODE_MODEL` in a settings file is a full model ID that the auto mode
// classifier uses (docs/rules/settings-env-auto-mode-model.md). An alias is not a full model ID.
// The list of models that the classifier ignores is in `src/data/auto-mode-model.ts`.
import type { JSONRuleDefinition } from '@eslint/json'
import { isIgnoredClassifierModel } from '../data/auto-mode-model.ts'
import { isModelAlias, modelVersionOf } from '../data/models.ts'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-env-auto-mode-model' as const

const VARIABLE = 'CLAUDE_CODE_AUTO_MODE_MODEL'

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'alias' | 'ignored' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Set CLAUDE_CODE_AUTO_MODE_MODEL to a full model ID that the classifier uses',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      alias:
        'The value "{{value}}" of "CLAUDE_CODE_AUTO_MODE_MODEL" is not a full model ID. The docs say to set a full model ID, such as "claude-sonnet-4-6".',
      ignored:
        'The value "{{value}}" of "CLAUDE_CODE_AUTO_MODE_MODEL" names a model that the auto mode classifier does not use, so the default classifier model reviews. Set another model.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const env = lastMember(node.body, 'env')?.value
        if (env?.type !== 'Object') {
          return
        }
        // Two keys of one name: the last counts, as in `JSON.parse`. A value that is not a string
        // is for `settings-env-value-format`.
        const value = lastMember(env, VARIABLE)?.value
        if (value?.type !== 'String') {
          return
        }
        if (isModelAlias(value.value)) {
          context.report({ node: value, messageId: 'alias', data: { value: value.value } })
          return
        }
        const model = modelVersionOf(value.value)
        if (model !== undefined && isIgnoredClassifierModel(model)) {
          context.report({ node: value, messageId: 'ignored', data: { value: value.value } })
        }
      },
    }
  },
}

export const target = {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
}

export default rule
