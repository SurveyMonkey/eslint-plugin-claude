// A `headersHelper` in a project `.mcp.json` (docs/rules/mcp-headershelper-committed.md). The
// value is an arbitrary shell command. Claude Code runs it after a user accepts the trust dialog
// for the project directory. So a committed file that holds one runs a command that the
// repository supplies. The rule reads the project file only. A `both` file, the root `.mcp.json`
// of a repository that is a plugin, is a project file too. A plugin is code that a user
// installs on purpose. The docs name the project `.mcp.json` for the trust rule.
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
    // A `both` file is a project file too. The project reads the `mcpServers` object only.
    const kind = mcpFileKind(context.filename)
    if (kind === null || kind === 'plugin') {
      return {}
    }
    return {
      Document(node) {
        for (const member of serverMembers(node.body, 'project')) {
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

export const target = {
  name,
  language: 'json' as const,
  files: ['**/.mcp.json'],
}

export default rule
