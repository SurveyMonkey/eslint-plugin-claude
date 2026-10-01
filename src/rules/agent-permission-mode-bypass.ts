// `permissionMode: bypassPermissions` in a local subagent file does nothing
// on current Claude Code, and granted bypass before v2.1.267
// (docs/rules/agent-permission-mode-bypass.md). Claude Code ignores the field
// in a plugin agent, so the rule checks only files in `.claude/agents/`.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { docsUrl } from '../docs-url.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'agent-permission-mode-bypass' as const

const rule: MarkdownRuleDefinition<{ MessageIds: 'bypass' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not set permissionMode to bypassPermissions in a local subagent',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      bypass:
        '`permissionMode: bypassPermissions` has no effect since Claude Code v2.1.267, unless the main session already bypasses permissions. Earlier versions granted bypass. Remove it.',
    },
  },
  create(context) {
    if (classifyAgentFile(context.filename)?.plugin !== false) {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const field = fm?.fields.get('permissionMode')
        if (fm !== null && field !== undefined && fm.data.permissionMode === 'bypassPermissions') {
          context.report({ loc: fm.at(field.valueStart, field.valueEnd), messageId: 'bypass' })
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
