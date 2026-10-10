// Hidden whitespace in a server entry (docs/rules/mcp-hidden-whitespace.md). Claude Code
// warns about whitespace at the start or end of `command`, `url`, each `args` item, and the
// keys and values of `env` and `headers`. It uses the values as written. A pasted token with
// a trailing newline is the usual cause. The message names the field, not the value.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember, type ValueNode } from '../marketplace-json.ts'
import { mcpFileKind, serverMembers } from '../mcp-servers.ts'

const name = 'mcp-hidden-whitespace' as const

/** True when `value` is a string with whitespace at the start or the end. */
const hasEdgeWhitespace = (value: string) => value !== value.trim()

const rule: JSONRuleDefinition<{ MessageIds: 'value' | 'key' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Remove leading and trailing whitespace from the values of an MCP server',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      value:
        'The value of `{{field}}` in the server "{{server}}" has leading or trailing whitespace. Claude Code uses it as written.',
      key: 'A key of `{{field}}` in the server "{{server}}" has leading or trailing whitespace. Claude Code uses it as written.',
    },
  },
  create(context) {
    const kind = mcpFileKind(context.filename)
    if (kind === null) {
      return {}
    }
    return {
      Document(node) {
        for (const member of serverMembers(node.body, kind)) {
          const server = keyOf(member.name)
          const config = member.value
          if (config.type !== 'Object') {
            continue
          }

          /** Report a string `node` of the field `field` when it has edge whitespace. */
          const checkValue = (value: ValueNode | undefined, field: string) => {
            if (value?.type === 'String' && hasEdgeWhitespace(value.value)) {
              context.report({ node: value, messageId: 'value', data: { field, server } })
            }
          }

          /** Check each key and each string value of the object member `key` of `config`. */
          const checkMap = (key: string) => {
            const map = lastMember(config, key)?.value
            if (map?.type !== 'Object') {
              return
            }
            for (const entry of map.members) {
              const entryKey = keyOf(entry.name)
              if (hasEdgeWhitespace(entryKey)) {
                context.report({
                  node: entry.name,
                  messageId: 'key',
                  data: { field: key, server },
                })
              }
              checkValue(entry.value, `${key}.${entryKey}`)
            }
          }

          checkValue(lastMember(config, 'command')?.value, 'command')
          checkValue(lastMember(config, 'url')?.value, 'url')
          const args = lastMember(config, 'args')?.value
          if (args?.type === 'Array') {
            for (const [index, element] of args.elements.entries()) {
              checkValue(element.value, `args[${index}]`)
            }
          }
          checkMap('env')
          checkMap('headers')
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
