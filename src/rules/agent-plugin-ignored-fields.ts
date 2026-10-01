// Claude Code ignores four frontmatter fields of a plugin agent
// (docs/rules/agent-plugin-ignored-fields.md). The rule checks only files in
// the `agents/` directory of a plugin.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { docsUrl } from '../docs-url.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'agent-plugin-ignored-fields' as const

// Each ignored field, with the way to get the same effect.
const IGNORED = new Map([
  ['permissionMode', 'Copy the agent to `.claude/agents/` if it needs this field.'],
  ['hooks', 'Declare the hooks in `hooks/hooks.json` of the plugin.'],
  ['mcpServers', 'Declare the servers in `.mcp.json` of the plugin.'],
  ['initialPrompt', 'Remove the field.'],
])

const rule: MarkdownRuleDefinition<{ MessageIds: 'ignored' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Leave out the frontmatter fields that Claude Code ignores in a plugin agent',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      ignored: '`{{key}}` has no effect in a plugin agent. Claude Code ignores it. {{advice}}',
    },
  },
  create(context) {
    if (classifyAgentFile(context.filename)?.plugin !== true) {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        if (fm === null) {
          return
        }
        for (const { key, keyStart, keyEnd } of fm.fields.values()) {
          const advice = IGNORED.get(key)
          if (advice !== undefined) {
            context.report({
              loc: fm.at(keyStart, keyEnd),
              messageId: 'ignored',
              data: { key, advice },
            })
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
