// An `env` variable that other config voids (docs/rules/settings-env-shadowed.md). The rule reads
// the linted file only. It leaves out the `model` field of an agent under
// `CLAUDE_CODE_SUBAGENT_MODEL_FORCE`: `agent-model-forced` owns that case.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember, type MemberNode, type ValueNode } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-env-shadowed' as const

type MessageId =
  | 'bashLength'
  | 'defaultModelSet'
  | 'defaultModelValue'
  | 'subagentInherit'
  | 'shellOnly'

/** The values that make Claude Code ignore `ANTHROPIC_DEFAULT_MODEL`. */
const IGNORED_DEFAULT_MODEL_VALUES = ['default', 'inherit', 'opusplan', 'haiku']

/** The variables that reach subprocesses only when a settings file sets them. */
const SHELL_ONLY_VARIABLES = ['NO_COLOR', 'FORCE_COLOR']

/** The last member `key` of `object`, unless its value is `null`. A `null` removes a key. */
function setMember(object: ValueNode | undefined, key: string): MemberNode | undefined {
  const member = lastMember(object, key)
  return member?.value.type === 'Null' ? undefined : member
}

/** The text of a member whose value is a string that is not empty. An empty value cancels a value
 *  of the shell, so it voids nothing, and nothing voids it. */
function textOf(member: MemberNode | undefined): string | undefined {
  return member?.value.type === 'String' && member.value.value !== ''
    ? member.value.value
    : undefined
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not set an env variable that another setting or its own value voids',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      bashLength:
        '"BASH_MAX_OUTPUT_LENGTH" has no effect while "bashOutputMaxChars" is set. Claude Code ignores the variable.',
      defaultModelSet:
        '"ANTHROPIC_DEFAULT_MODEL" has no effect while "model" is set. Claude Code uses the variable only when no setting selects a model.',
      defaultModelValue:
        'Claude Code ignores "ANTHROPIC_DEFAULT_MODEL" when its value is "default", "inherit", "opusplan" or "haiku". The value is "{{value}}".',
      subagentInherit:
        '"CLAUDE_CODE_SUBAGENT_MODEL": "inherit" is the same as an unset variable. Remove it.',
      shellOnly:
        '"{{key}}" in "env" reaches subprocesses only. It does not change the colors of Claude Code. Set it in your shell before you start "claude".',
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
        if (env?.type !== 'Object') {
          return
        }

        const bash = setMember(env, 'BASH_MAX_OUTPUT_LENGTH')
        if (
          bash !== undefined &&
          textOf(bash) !== undefined &&
          setMember(body, 'bashOutputMaxChars') !== undefined
        ) {
          context.report({ node: bash.name, messageId: 'bashLength' })
        }

        const fallback = setMember(env, 'ANTHROPIC_DEFAULT_MODEL')
        const value = textOf(fallback)
        if (fallback !== undefined && value !== undefined) {
          // An ignored value and a `model` are two reasons for one fault. The value comes first.
          if (IGNORED_DEFAULT_MODEL_VALUES.includes(value)) {
            context.report({
              node: fallback.value,
              messageId: 'defaultModelValue',
              data: { value },
            })
          } else if (setMember(body, 'model')?.value.type === 'String') {
            context.report({ node: fallback.name, messageId: 'defaultModelSet' })
          }
        }

        const subagent = setMember(env, 'CLAUDE_CODE_SUBAGENT_MODEL')
        if (subagent !== undefined && textOf(subagent) === 'inherit') {
          context.report({ node: subagent.value, messageId: 'subagentInherit' })
        }

        for (const key of SHELL_ONLY_VARIABLES) {
          const member = setMember(env, key)
          if (member !== undefined) {
            context.report({ node: member.name, messageId: 'shellOnly', data: { key } })
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
