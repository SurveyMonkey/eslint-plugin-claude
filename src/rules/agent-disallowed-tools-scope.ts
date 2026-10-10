// `disallowedTools` removes a whole tool, whatever its entry says
// (docs/rules/agent-disallowed-tools-scope.md). An entry with a specifier
// does not block only the matching calls, and a tool in both lists is removed.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { docsUrl } from '../docs-url.ts'
import { COMMA, listEntries } from '../frontmatter-list.ts'
import { parsePermissionRule } from '../permission-rule.ts'
import { readFrontmatter, type SkillFrontmatter } from '../skill-frontmatter.ts'

const name = 'agent-disallowed-tools-scope' as const

/** The tool name of each entry of the field `key` that parses, with the entry. */
function toolsOf(fm: SkillFrontmatter, yaml: string, key: string) {
  return listEntries(fm, yaml, key, COMMA).flatMap(({ text, loc }) => {
    const parsed = parsePermissionRule(text)
    return parsed.ok ? [{ text, loc, tool: parsed.tool, specifier: parsed.specifier }] : []
  })
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'specifier' | 'both' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Use disallowedTools for a whole tool, and permissions.deny for a part of it',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      specifier:
        '`{{entry}}` in `disallowedTools` removes the whole {{tool}} tool from the subagent, not only the matching calls. To block some calls, add a deny rule to `permissions.deny`.',
      both: '{{tool}} is in `tools` and in `disallowedTools`. Claude Code removes the tool, so this entry has no effect.',
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
        const denied = toolsOf(fm, node.value, 'disallowedTools')
        for (const { text, loc, tool, specifier } of denied) {
          if (specifier !== null) {
            context.report({ loc, messageId: 'specifier', data: { entry: text, tool } })
          }
        }
        // `Task` is the old name of `Agent`, and Claude Code still reads it.
        const canonical = (tool: string) => (tool === 'Task' ? 'Agent' : tool)
        for (const { loc, tool } of toolsOf(fm, node.value, 'tools')) {
          if (denied.some((entry) => canonical(entry.tool) === canonical(tool))) {
            context.report({ loc, messageId: 'both', data: { tool } })
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
