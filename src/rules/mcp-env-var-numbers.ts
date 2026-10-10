// The MCP timeouts in the `env` block of a settings file (docs/rules/mcp-env-var-numbers.md).
// The env vars reference gives each in milliseconds. A plain number below 1000 is under one
// second, and is most likely a count of seconds. For `MCP_TOOL_TIMEOUT` and
// `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT`, the reference says that Claude Code raises such a value to
// one second. For the other three, the docs state no floor, and the rule reports as a heuristic.
// A value of 0 is not read: two of the variables take 0 as an off value. `MAX_MCP_OUTPUT_TOKENS`
// is not read, because the docs give no floor for it. A value that is not plain digits is not read.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'mcp-env-var-numbers' as const

/** The variables that the docs say Claude Code raises to one second when the value is below 1000.
 *  (https://code.claude.com/docs/en/env-vars#variables) */
const FLOORED = ['MCP_TOOL_TIMEOUT', 'CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT']

/** The variables that hold milliseconds, and that the docs give no floor. */
const OTHER_MILLISECONDS = [
  'MCP_TIMEOUT',
  'MCP_CONNECT_TIMEOUT_MS',
  'CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS',
]

const PLAIN_DIGITS = /^\d+$/

const rule: JSONRuleDefinition<{ MessageIds: 'floored' | 'seconds' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Write an MCP timeout in the env block of a settings file in milliseconds',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      floored:
        'The value of "{{name}}" is {{value}}, a number of milliseconds. Claude Code raises a value below 1000 to one second. If you meant seconds, write the number of milliseconds.',
      seconds:
        'The value of "{{name}}" is {{value}}, a number of milliseconds, which is under one second. If you meant seconds, write the number of milliseconds.',
    },
  },
  create(context) {
    // Claude Code ignores a hidden file in `managed-settings.d`.
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const env = lastMember(node.body, 'env')?.value
        if (env?.type !== 'Object') {
          return
        }
        for (const member of env.members) {
          const variable = keyOf(member.name)
          const { value } = member
          // Two keys of one name: the last counts, as in `JSON.parse`.
          if (lastMember(env, variable) !== member || value.type !== 'String') {
            continue
          }
          const floored = FLOORED.includes(variable)
          if (!floored && !OTHER_MILLISECONDS.includes(variable)) {
            continue
          }
          const number = Number(value.value)
          if (PLAIN_DIGITS.test(value.value) && number > 0 && number < 1000) {
            context.report({
              node: value,
              messageId: floored ? 'floored' : 'seconds',
              data: { name: variable, value: value.value },
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
