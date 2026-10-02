// The `mcpServers` field of a local subagent file is a list. Each entry is a
// server name, or a map with one key: the server name
// (docs/rules/agent-mcp-servers-schema.md). Claude Code ignores the field in a
// plugin agent, so the rule checks only files in `.claude/agents/`.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { MCP_SERVER_TYPES } from '../data/agent-fields.ts'
import { docsUrl } from '../docs-url.ts'
import { isMap } from '../frontmatter-values.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'agent-mcp-servers-schema' as const

type Problem = { messageId: 'badEntry' | 'badConfig' | 'badType'; data: Record<string, string> }

/** The fault in the entry at `index`, or null. */
function entryProblem(entry: unknown, index: number): Problem | null {
  if (typeof entry === 'string') {
    return null
  }
  const keys = isMap(entry) ? Object.keys(entry) : []
  if (!isMap(entry) || keys.length !== 1) {
    return { messageId: 'badEntry', data: { index: String(index) } }
  }
  const server = keys[0] as string
  const config = entry[server]
  if (!isMap(config)) {
    return { messageId: 'badConfig', data: { server } }
  }
  const { type } = config
  if (type !== undefined && !(MCP_SERVER_TYPES as readonly string[]).includes(type as string)) {
    return { messageId: 'badType', data: { server, type: String(type) } }
  }
  return null
}

const rule: MarkdownRuleDefinition<{
  MessageIds: 'notList' | 'badEntry' | 'badConfig' | 'badType'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write the mcpServers field of a local subagent as a list of servers',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      notList: '`mcpServers` must be a list of server names and inline server maps.',
      badEntry:
        'Entry {{index}} of `mcpServers` must be a server name, or a map with one key: the server name.',
      badConfig: 'The inline server `{{server}}` must have a map as its config.',
      badType:
        'The inline server `{{server}}` has the type `{{type}}`. Use stdio, http, sse or ws.',
    },
  },
  create(context) {
    if (classifyAgentFile(context.filename)?.plugin !== false) {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const value = fm?.data.mcpServers
        if (fm === null || value === undefined || value === null) {
          return
        }
        // The field exists, because the value is set.
        const field = fm.fields.get('mcpServers') as { valueStart: number; valueEnd: number }
        const loc = fm.at(field.valueStart, field.valueEnd)
        if (!Array.isArray(value)) {
          context.report({ loc, messageId: 'notList' })
          return
        }
        for (const [index, entry] of value.entries()) {
          const problem = entryProblem(entry, index)
          if (problem !== null) {
            context.report({ loc, ...problem })
          }
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
