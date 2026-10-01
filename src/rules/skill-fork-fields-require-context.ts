// `agent` and `background` apply only with `context: fork`
// (docs/rules/skill-fork-fields-require-context.md).
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'skill-fork-fields-require-context' as const

const rule: MarkdownRuleDefinition<{ MessageIds: 'needsFork' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Set agent and background only with context: fork',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      needsFork: '`{{key}}` has no effect without `context: fork`.',
    },
  },
  create(context) {
    if (classifySkillFile(context.filename) === null) {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        if (fm === null || fm.data.context === 'fork') {
          return
        }
        for (const key of ['agent', 'background']) {
          const field = fm.fields.get(key)
          // An empty value is an absent field.
          if (field !== undefined && fm.data[key] != null) {
            context.report({
              loc: fm.at(field.keyStart, field.keyEnd),
              messageId: 'needsFork',
              data: { key },
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
  files: ['**/SKILL.md', '**/commands/**/*.md'],
  rule,
}
