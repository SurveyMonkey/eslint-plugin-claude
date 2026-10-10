// A `${VAR}` reference in a server field that does not expand it
// (docs/rules/mcp-env-expansion-field.md). Claude Code expands references in `command`, `args`,
// `env`, `url` and `headers`. In any other field, such as `oauth.*` or `timeout`, the text stays
// as written. `headersHelper` is not in the list. It runs in a shell, and the shell reads
// `${VAR}`. So the rule skips it.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { keyOf, type ValueNode } from '../marketplace-json.ts'
import { lastMembers, mcpFileKind, serverMembers } from '../mcp-servers.ts'

const name = 'mcp-env-expansion-field' as const

type StringNode = Extract<ValueNode, { type: 'String' }>

const REFERENCE = /\$\{[^}]+\}/

/** The fields of a server where Claude Code expands a reference, and the field that a shell reads. */
const SKIPPED_FIELDS: readonly string[] = [
  'command',
  'args',
  'env',
  'url',
  'headers',
  'headersHelper',
]

/** The string nodes inside `value`, at any depth. Of two members with one name, the last counts. */
function stringsOf(value: ValueNode): StringNode[] {
  switch (value.type) {
    case 'String':
      return [value]
    case 'Object':
      return lastMembers(value.members).flatMap((member) => stringsOf(member.value))
    case 'Array':
      return value.elements.flatMap((element) => stringsOf(element.value))
    default:
      return []
  }
}

const rule: JSONRuleDefinition<{ MessageIds: 'literal' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: `Use a \${VAR} reference in an MCP server only in a field that expands it`,
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      literal: `The \`{{field}}\` of the server "{{server}}" holds a \`\${...}\` reference. Claude Code expands references in \`command\`, \`args\`, \`env\`, \`url\` and \`headers\` only, so this one stays as written.`,
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
          if (member.value.type !== 'Object') {
            continue
          }
          for (const field of lastMembers(member.value.members)) {
            const key = keyOf(field.name)
            if (SKIPPED_FIELDS.includes(key)) {
              continue
            }
            for (const text of stringsOf(field.value)) {
              if (REFERENCE.test(text.value)) {
                context.report({
                  node: text,
                  messageId: 'literal',
                  data: { field: key, server: keyOf(member.name) },
                })
              }
            }
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
