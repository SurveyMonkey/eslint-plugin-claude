// `memory` in a subagent file turns on the Read, Write and Edit tools, even
// when `tools` leaves them out (docs/rules/agent-memory-grants-write.md).
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { MEMORY_SCOPES } from '../data/agent-fields.ts'
import { docsUrl } from '../docs-url.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'agent-memory-grants-write' as const

const GRANTED = ['Write', 'Edit']

/** The tool names in `tools`, without specifiers, or null when `tools` is
 *  neither a string nor a list of strings. */
function toolNames(tools: unknown): string[] | null {
  const entries =
    typeof tools === 'string'
      ? tools.split(',')
      : Array.isArray(tools) && tools.every((t) => typeof t === 'string')
        ? (tools as string[])
        : null
  return entries?.map((entry) => entry.replace(/\(.*$/s, '').trim()) ?? null
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'grantsWrite' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not use memory in a subagent whose tools list leaves out Write and Edit',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      grantsWrite:
        '`memory` turns on Write and Edit, and `tools` leaves out {{missing}}. The agent can write files that the list does not allow.',
    },
  },
  create(context) {
    if (classifyAgentFile(context.filename) === null) {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const field = fm?.fields.get('tools')
        if (
          fm === null ||
          field === undefined ||
          !(MEMORY_SCOPES as readonly string[]).includes(fm.data.memory as string)
        ) {
          return
        }
        const names = toolNames(fm.data.tools)
        const missing = GRANTED.filter((tool) => !names?.includes(tool))
        if (names !== null && missing.length > 0) {
          context.report({
            loc: fm.at(field.valueStart, field.valueEnd),
            messageId: 'grantsWrite',
            data: { missing: missing.map((tool) => `\`${tool}\``).join(' and ') },
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
