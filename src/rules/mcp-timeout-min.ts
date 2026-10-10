// The per-server `timeout` of `.mcp.json` (docs/rules/mcp-timeout-min.md). The unit is
// milliseconds. Claude Code ignores a value below 1000 and falls through to `MCP_TOOL_TIMEOUT`.
// A value of `60` written as seconds is the usual cause. No Claude Code setting moves the
// number, so the schema sets 1000 as the minimum of the option `min`. A team can raise it.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { mcpFileKind, serverMembers } from '../mcp-servers.ts'

const name = 'mcp-timeout-min' as const

// The limit in the docs, and the default of `min`: 1000 milliseconds.
const TIMEOUT_MIN = 1000

type Options = [{ min: number }]

const rule: JSONRuleDefinition<{
  RuleOptions: Options
  MessageIds: 'tooSmall' | 'underConfiguredLimit'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write the timeout of an MCP server in milliseconds, at 1000 or more',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { min: { type: 'integer', minimum: TIMEOUT_MIN } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ min: TIMEOUT_MIN }],
    messages: {
      tooSmall:
        'The `timeout` of the server "{{server}}" is {{value}}. The unit is milliseconds. Claude Code ignores a value below {{min}}, and the server falls back to `MCP_TOOL_TIMEOUT`.',
      underConfiguredLimit:
        'The `timeout` of the server "{{server}}" is {{value}}. The configured minimum is {{min}} milliseconds.',
    },
  },
  create(context) {
    const kind = mcpFileKind(context.filename)
    if (kind === null) {
      return {}
    }
    const [{ min }] = context.options
    return {
      Document(node) {
        for (const member of serverMembers(node.body, kind)) {
          const timeout = lastMember(member.value, 'timeout')?.value
          if (timeout?.type === 'Number' && timeout.value < min) {
            context.report({
              node: timeout,
              // At another value, the message names the configured minimum and claims no docs limit.
              messageId: min === TIMEOUT_MIN ? 'tooSmall' : 'underConfiguredLimit',
              data: {
                server: keyOf(member.name),
                value: String(timeout.value),
                min: String(min),
              },
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
  files: ['**/.mcp.json'],
  rule,
}
