// A key in the shared settings file that runs a shell command
// (docs/rules/settings-committed-helper-command.md). The keys are in
// `src/data/settings-keys.ts`. The rule reads `.claude/settings.json` only. A local file is for
// one user, and a managed file is a policy.
import type { JSONRuleDefinition } from '@eslint/json'
import { COMMAND_OBJECT_KEYS, COMMAND_STRING_KEYS } from '../data/settings-keys.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember, type ValueNode } from '../marketplace-json.ts'

const name = 'settings-committed-helper-command' as const

/** True when `value` is a string that is not empty. */
const isText = (value: ValueNode | undefined) => value?.type === 'String' && value.value !== ''

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'helper' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not set a shell command key in the shared settings file',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      helper:
        '"{{key}}" in the shared settings file runs a shell command that the repository supplies. Claude Code runs it after the trust prompt in an interactive session, and in "claude -p" with no trust prompt. Set it in user settings or in the local file.',
    },
  },
  create(context) {
    return {
      Document(node) {
        if (node.body.type !== 'Object') {
          return
        }
        const body = node.body
        for (const member of body.members) {
          const key = keyOf(member.name)
          // Two keys of one name: the last counts, as in `JSON.parse`. A value of another shape is
          // for `settings-schema`, and an empty command runs nothing.
          if (lastMember(body, key) !== member) {
            continue
          }
          const { value } = member
          const runs =
            (COMMAND_STRING_KEYS.includes(key) && isText(value)) ||
            (COMMAND_OBJECT_KEYS.includes(key) && isText(lastMember(value, 'command')?.value))
          if (runs) {
            context.report({ node: member.name, messageId: 'helper', data: { key } })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude/settings.json'],
  rule,
}
