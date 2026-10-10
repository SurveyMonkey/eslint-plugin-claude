// A relative file path in the `command` or `args` of a project `.mcp.json`
// (docs/rules/mcp-stdio-relative-path.md). Claude Code starts the server in the directory where the
// user started it, not in the directory of `.mcp.json`. So `./server.js` fails when the user
// starts Claude Code in a subdirectory. The docs give `${CLAUDE_PROJECT_DIR:-.}/server.js`. The
// rule reports a string that starts with `./` or `../`. It reads each `args` item as one word, as
// the file lists them, because the plugin has no shell word splitter. A plugin file is out of
// scope. `mcp-project-dir-default` owns a `${CLAUDE_PROJECT_DIR}` with no default.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember, type ValueNode } from '../marketplace-json.ts'
import { mcpFileKind, serverMembers } from '../mcp-servers.ts'

const name = 'mcp-stdio-relative-path' as const

const RELATIVE_START = /^\.\.?\//

const rule: JSONRuleDefinition<{ MessageIds: 'relative' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not use a ./ or ../ path in the command or args of a project MCP server',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      relative: `The \`{{field}}\` of the server "{{server}}" is the relative path "{{path}}". Claude Code starts the server in the directory where the user started it, not where \`.mcp.json\` is. Write \`\${CLAUDE_PROJECT_DIR:-.}/...\`.`,
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

          /** Report a string `value` of the field `field` that starts with `./` or `../`. */
          const check = (value: ValueNode | undefined, field: string) => {
            if (value?.type === 'String' && RELATIVE_START.test(value.value)) {
              context.report({
                node: value,
                messageId: 'relative',
                data: { field, server, path: value.value },
              })
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
