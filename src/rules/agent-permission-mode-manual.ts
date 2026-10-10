// `permissionMode: manual` is an alias for `default`. The docs say to write
// the config value (docs/rules/agent-permission-mode-manual.md). Claude Code
// ignores the field in a plugin agent, so the rule checks only files in
// `.claude/agents/`.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { docsUrl } from '../docs-url.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'agent-permission-mode-manual' as const

const rule: MarkdownRuleDefinition<{ MessageIds: 'manual' | 'useDefault' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Write permissionMode: default, not the alias manual, in a local subagent',
      url: docsUrl(name),
    },
    hasSuggestions: true,
    schema: [],
    messages: {
      manual: '`manual` is an alias for `default`. Write the config value `default`.',
      useDefault: 'Change the value to `default`.',
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
        if (fm !== null && field !== undefined && fm.data.permissionMode === 'manual') {
          context.report({
            loc: fm.at(field.valueStart, field.valueEnd),
            messageId: 'manual',
            suggest: [
              {
                messageId: 'useDefault',
                fix: (fixer) =>
                  fixer.replaceTextRange(
                    [fm.base + field.valueStart, fm.base + field.valueEnd],
                    'default',
                  ),
              },
            ],
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
