// A `headersHelper` in a project `.mcp.json` (docs/rules/mcp-headershelper-committed.md). The
// value is an arbitrary shell command. Claude Code runs it after a user accepts the trust dialog
// for the project directory. So a committed file that holds one runs a command that the
// repository supplies. The rule reads the project file only. A plugin is code that a user
// installs on purpose, and the docs name the project `.mcp.json` for the trust rule.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { mcpFileKind, serverMembers } from '../mcp-servers.ts'

const name = 'mcp-headershelper-committed' as const

const rule: JSONRuleDefinition<{ MessageIds: 'committed' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Review each headersHelper in a committed project .mcp.json',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      committed:
        'The server "{{server}}" has a `headersHelper` in a committed `.mcp.json`. It is a shell command that runs once a user trusts the folder. Make sure that the repository should supply it.',
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
          const helper = lastMember(member.value, 'headersHelper')?.value
          if (helper?.type === 'String') {
            context.report({
              node: helper,
              messageId: 'committed',
              data: { server: keyOf(member.name) },
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
