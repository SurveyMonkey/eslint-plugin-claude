// The body of a subagent file is the system prompt of the agent
// (docs/rules/agent-body-nonempty.md). A file with a frontmatter block and no body gives the agent
// no instructions.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { docsUrl } from '../docs-url.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'agent-body-nonempty' as const

const rule: MarkdownRuleDefinition<{ MessageIds: 'empty' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Give a subagent file a body, because the body is its system prompt',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      empty:
        'The file has no body after the frontmatter. The body is the system prompt of the agent, so the agent has no instructions.',
    },
  },
  create(context) {
    if (classifyAgentFile(context.filename) === null) {
      return {}
    }
    const { sourceCode } = context
    return {
      yaml(node) {
        // A block that does not parse, or a file with no block, is a fault for another rule.
        if (readFrontmatter(sourceCode, node) === null) {
          return
        }
        if (sourceCode.text.slice(sourceCode.getRange(node)[1]).trim() !== '') {
          return
        }
        // The report is on the last delimiter, which ends the block.
        const { end } = sourceCode.getLoc(node)
        context.report({ loc: { start: { line: end.line, column: 1 }, end }, messageId: 'empty' })
      },
    }
  },
}

export default { name, language: 'markdown' as const, files: ['**/*.md'], rule }
