// Claude Code removes some tools from every subagent, and it removes the
// built-in tools outside a small set from a background subagent. A `tools`
// entry for such a tool has no effect (docs/rules/agent-tools-unavailable.md).
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import {
  BACKGROUND_TOOL_NAMES,
  SUBAGENT_PLAN_MODE_TOOL,
  SUBAGENT_REMOVED_TOOLS,
  TOOL_NAMES,
} from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { COMMA, listEntries } from '../frontmatter-list.ts'
import { parsePermissionRule } from '../permission-rule.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'agent-tools-unavailable' as const

const rule: MarkdownRuleDefinition<{ MessageIds: 'removed' | 'planMode' | 'background' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not list in tools a tool that Claude Code removes from the subagent',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      removed: 'Claude Code removes {{tool}} from every subagent, so this entry has no effect.',
      planMode:
        'Claude Code removes {{tool}} from a subagent unless its permissionMode is plan, so this entry has no effect.',
      background:
        'Claude Code removes {{tool}} from a background subagent, and `background` is true. This entry has no effect.',
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
        for (const { text, loc } of listEntries(fm, node.value, 'tools', COMMA)) {
          const parsed = parsePermissionRule(text)
          if (!parsed.ok) {
            continue
          }
          const { tool } = parsed
          if (SUBAGENT_REMOVED_TOOLS.includes(tool)) {
            context.report({ loc, messageId: 'removed', data: { tool } })
          } else if (tool === SUBAGENT_PLAN_MODE_TOOL && fm.data.permissionMode !== 'plan') {
            context.report({ loc, messageId: 'planMode', data: { tool } })
          } else if (
            fm.data.background === true &&
            TOOL_NAMES.includes(tool) &&
            !BACKGROUND_TOOL_NAMES.includes(tool)
          ) {
            context.report({ loc, messageId: 'background', data: { tool } })
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
