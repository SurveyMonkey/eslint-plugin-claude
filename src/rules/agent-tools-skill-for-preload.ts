// `Skill` in the `tools` of a subagent lets the subagent call the Skill tool. It does not preload
// a skill. The `skills` field preloads skills (docs/rules/agent-tools-skill-for-preload.md).
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { docsUrl } from '../docs-url.ts'
import { COMMA, listEntries } from '../frontmatter-list.ts'
import { parsePermissionRule } from '../permission-rule.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'agent-tools-skill-for-preload' as const

const rule: MarkdownRuleDefinition<{ MessageIds: 'skillTool' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Preload skills with the skills field, not with Skill in tools',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      skillTool:
        '`Skill` in `tools` does not preload a skill. To preload skills into the subagent, list them in `skills`.',
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
        const { skills } = fm.data
        // A field with a value, other than an empty list, names skills to preload.
        if (
          skills !== undefined &&
          skills !== null &&
          !(Array.isArray(skills) && skills.length === 0)
        ) {
          return
        }
        for (const { text, loc } of listEntries(fm, node.value, 'tools', COMMA)) {
          const parsed = parsePermissionRule(text)
          // `Skill(name)` is the business of `agent-tools-known`.
          if (parsed.ok && parsed.tool === 'Skill' && parsed.specifier === null) {
            context.report({ loc, messageId: 'skillTool' })
          }
        }
      },
    }
  },
}

export default { name, language: 'markdown' as const, files: ['**/agents/**/*.md'], rule }
