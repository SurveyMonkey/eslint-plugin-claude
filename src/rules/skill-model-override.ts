// A `model` in the frontmatter of a skill or command switches the model for the turn that runs
// it (docs/rules/skill-model-override.md). Each model has its own prompt cache. When the model
// differs from the session model, the switch reads the whole conversation again with no cache hit.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'skill-model-override' as const

/** The value that keeps the active model. */
const INHERIT = 'inherit'

const rule: MarkdownRuleDefinition<{ MessageIds: 'override' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not switch the model in a skill or command',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      override:
        '`model: {{value}}` can switch the model for the turn that runs this skill. If it differs from the session model, the next request reads the whole conversation with no cache hit. Remove `model`, or set `inherit`.',
    },
  },
  create(context) {
    if (classifySkillFile(context.filename) === null) {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const field = fm?.fields.get('model')
        const value = fm?.data.model
        // The value of a forked skill sets the model of the subagent. The conversation of the
        // session keeps its cache.
        if (
          fm === null ||
          field === undefined ||
          typeof value !== 'string' ||
          value === '' ||
          value === INHERIT ||
          fm.data.context === 'fork'
        ) {
          return
        }
        context.report({
          loc: fm.at(field.keyStart, field.valueEnd),
          messageId: 'override',
          data: { value },
        })
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
