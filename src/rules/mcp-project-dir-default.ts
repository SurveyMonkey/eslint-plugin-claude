// `${CLAUDE_PROJECT_DIR}` with no default in a project `.mcp.json`
// (docs/rules/mcp-project-dir-default.md). Claude Code sets the variable in the environment of the
// server it starts. It does not set it in its own environment, where `${VAR}` expansion reads it.
// So `command` and `args` need a default such as `${CLAUDE_PROJECT_DIR:-.}`. A plugin config
// substitutes the variable directly, so the rule skips plugin files.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember, type ValueNode } from '../marketplace-json.ts'
import { mcpFileKind, serverMembers } from '../mcp-servers.ts'

const name = 'mcp-project-dir-default' as const

const BARE_REFERENCE = /\$\{CLAUDE_PROJECT_DIR\}/

const rule: JSONRuleDefinition<{ MessageIds: 'noDefault' }> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Give CLAUDE_PROJECT_DIR a default in the command or args of a project MCP server',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      noDefault: `The \`{{field}}\` of the server "{{server}}" uses \`\${CLAUDE_PROJECT_DIR}\` with no default. Write \`\${CLAUDE_PROJECT_DIR:-.}\`.`,
    },
  },
  create(context) {
    const kind = mcpFileKind(context.filename)
    if (kind !== 'project') {
      return {}
    }
    return {
      Document(node) {
        for (const member of serverMembers(node.body, kind)) {
          const server = keyOf(member.name)

          /** Report a string `value` of the field `field` that holds a bare reference. */
          const check = (value: ValueNode | undefined, field: string) => {
            if (value?.type === 'String' && BARE_REFERENCE.test(value.value)) {
              context.report({ node: value, messageId: 'noDefault', data: { field, server } })
            }
          }

          check(lastMember(member.value, 'command')?.value, 'command')
          const args = lastMember(member.value, 'args')?.value
          if (args?.type === 'Array') {
            for (const [index, element] of args.elements.entries()) {
              check(element.value, `args[${index}]`)
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
