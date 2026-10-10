// A credential variable in the `url` or `headers` of a remote server
// (docs/rules/mcp-credential-var-remote.md). In these fields Claude Code reads a covered
// credential variable as empty, whether or not it is set, and it ignores a `:-default`. A project
// file or a plugin cannot send a credential to a server it names. The names are in
// `src/data/mcp-credential-vars.ts`. The option `names` adds names. A message names the variable,
// never a value.
import type { JSONRuleDefinition } from '@eslint/json'
import { REMOTE_EMPTY_CREDENTIAL_VARS } from '../data/mcp-credential-vars.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember, type ValueNode } from '../marketplace-json.ts'
import { lastMembers, mcpFileKind, REMOTE_SERVER_TYPES, serverMembers } from '../mcp-servers.ts'

const name = 'mcp-credential-var-remote' as const

type Options = [{ names: string[] }]

const REFERENCE = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-[^}]*)?\}/g

const rule: JSONRuleDefinition<{ RuleOptions: Options; MessageIds: 'empty' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not use a credential variable in the url or headers of a remote MCP server',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { names: { type: 'array', items: { type: 'string', minLength: 1 } } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ names: [] }],
    messages: {
      empty:
        'The `{{field}}` of the server "{{server}}" uses `{{variable}}`. Claude Code reads this credential variable as empty in a remote server. Copy it into a variable with a name of your own.',
    },
  },
  create(context) {
    const kind = mcpFileKind(context.filename)
    if (kind === null) {
      return {}
    }
    const [{ names }] = context.options
    const covered = new Set([...REMOTE_EMPTY_CREDENTIAL_VARS, ...names])
    return {
      Document(node) {
        for (const member of serverMembers(node.body, kind)) {
          const type = lastMember(member.value, 'type')?.value
          if (type?.type !== 'String' || !REMOTE_SERVER_TYPES.includes(type.value)) {
            continue
          }
          const server = keyOf(member.name)

          /** Report each covered variable that the string `value` of `field` references. */
          const check = (value: ValueNode, field: string) => {
            if (value.type !== 'String') {
              return
            }
            const variables = new Set(
              Array.from(value.value.matchAll(REFERENCE), (match) => String(match[1])).filter(
                (variable) => covered.has(variable),
              ),
            )
            for (const variable of variables) {
              context.report({
                node: value,
                messageId: 'empty',
                data: { field, server, variable },
              })
            }
          }

          const url = lastMember(member.value, 'url')?.value
          if (url !== undefined) {
            check(url, 'url')
          }
          const headers = lastMember(member.value, 'headers')?.value
          if (headers?.type === 'Object') {
            for (const header of lastMembers(headers.members)) {
              check(header.value, `headers.${keyOf(header.name)}`)
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
