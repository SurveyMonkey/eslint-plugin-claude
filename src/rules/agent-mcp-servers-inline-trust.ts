// An inline MCP server in a project subagent file connects only after the user
// trusts the folder of the file
// (docs/rules/agent-mcp-servers-inline-trust.md). Claude Code ignores
// `mcpServers` in a plugin agent, so the rule checks only files in
// `.claude/agents/`.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { docsUrl } from '../docs-url.ts'
import { isMap } from '../frontmatter-values.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'agent-mcp-servers-inline-trust' as const

/** The names of the inline servers in the `mcpServers` value `value`: the
 *  keys of each map entry that has a map as its config. A name reference is
 *  a string. An entry of another shape is for `agent-mcp-servers-schema`. */
function inlineServers(value: unknown): string[] {
  return (Array.isArray(value) ? value : []).flatMap((entry: unknown) =>
    isMap(entry)
      ? Object.entries(entry)
          .filter(([, config]) => isMap(config))
          .map(([server]) => server)
      : [],
  )
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'trust' }> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Review the inline MCP servers of a project subagent before you trust the folder',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      trust:
        'This file defines inline MCP servers: {{servers}}. Claude Code connects them only after you trust the folder of this file. A `stdio` server also runs its command. A parent folder and a `-p` session do not count. Review each server.',
    },
  },
  create(context) {
    if (classifyAgentFile(context.filename)?.plugin !== false) {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const field = fm?.fields.get('mcpServers')
        if (fm === null || field === undefined) {
          return
        }
        const servers = inlineServers(fm.data.mcpServers)
        if (servers.length > 0) {
          context.report({
            loc: fm.at(field.valueStart, field.valueEnd),
            messageId: 'trust',
            data: { servers: servers.join(', ') },
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/agents/**/*.md'],
  rule,
}
