// A stdio server of a plugin that targets claude.ai (docs/rules/mcp-plugin-stdio-reach.md). A
// local stdio server runs in Claude Code and in a Cowork session on the machine of the user, and
// not on claude.ai. A remote `https://` server reaches claude.ai users as a connector. The plugin
// docs name no manifest or marketplace field for a claude.ai target, so a file cannot show it.
// The option `targets` names it, and the rule reports nothing without `claude-ai` in it. The rule
// reads the MCP configs of a plugin: the `.mcp.json` at its root and the servers of its manifest.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { lintedServers, mcpFileKind } from '../mcp-servers.ts'

const name = 'mcp-plugin-stdio-reach' as const

type Options = [{ targets: string[] }]

const rule: JSONRuleDefinition<{ RuleOptions: Options; MessageIds: 'stdio' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not declare a stdio MCP server in a plugin that targets claude.ai',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { targets: { type: 'array', items: { enum: ['claude-ai'] } } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ targets: [] }],
    messages: {
      stdio:
        'The server "{{server}}" runs a local command. A stdio server does not run on claude.ai. Use a remote https:// server to reach claude.ai users.',
    },
  },
  create(context) {
    const [{ targets }] = context.options
    if (!targets.includes('claude-ai')) {
      return {}
    }
    // A project `.mcp.json` is not a plugin config.
    if (
      path.basename(context.filename) !== 'plugin.json' &&
      mcpFileKind(context.filename) !== 'plugin'
    ) {
      return {}
    }
    return {
      Document(node) {
        for (const server of lintedServers(context.filename, node.body)) {
          const type = lastMember(server.member.value, 'type')?.value
          const isStdio =
            type === undefined
              ? lastMember(server.member.value, 'command') !== undefined
              : type.type === 'String' && type.value === 'stdio'
          if (isStdio) {
            context.report({
              node: server.pinned ?? server.member.name,
              messageId: 'stdio',
              data: { server: server.name },
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
  files: ['**/.mcp.json', '**/.claude-plugin/plugin.json'],
  rule,
}
