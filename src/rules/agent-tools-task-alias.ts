// Claude Code v2.1.63 renamed the Task tool to Agent. `Task` and `Task(...)`
// in a subagent file still work as aliases
// (docs/rules/agent-tools-task-alias.md).
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { docsUrl } from '../docs-url.ts'
import { COMMA, listEntries } from '../frontmatter-list.ts'
import { parsePermissionRule } from '../permission-rule.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'agent-tools-task-alias' as const

const rule: MarkdownRuleDefinition<{ MessageIds: 'alias' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Write Agent, not its old name Task, in the tools of a subagent',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      alias:
        '`{{entry}}` uses `Task`, the old name of the `Agent` tool. Claude Code v2.1.63 renamed it, and `Task` still works as an alias. Write `Agent`.',
    },
  },
  create(context) {
    if (classifyAgentFile(context.filename) === null) {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        if (fm === null) {
          return
        }
        for (const key of ['tools', 'disallowedTools']) {
          for (const { text, loc } of listEntries(fm, node.value, key, COMMA)) {
            const parsed = parsePermissionRule(text)
            if (parsed.ok && parsed.tool === 'Task') {
              context.report({ loc, messageId: 'alias', data: { entry: text } })
            }
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
