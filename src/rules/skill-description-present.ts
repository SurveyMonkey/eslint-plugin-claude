// A skill or command with no `description` (docs/rules/skill-description-present.md).
// The schema rule reports a `description` that is not a string, so this rule
// is silent for one.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { isEmptyBlock } from '../empty-block.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'skill-description-present' as const

const rule: MarkdownRuleDefinition<{ MessageIds: 'missing' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Set a description on a skill',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      missing:
        '`description` is missing or empty. Claude Code uses the first non-empty line of the content instead. The SDK omits a skill that has neither `description` nor `when_to_use`.',
    },
  },
  create(context) {
    if (classifySkillFile(context.filename) === null) {
      return {}
    }
    return {
      root(node) {
        const first = node.children[0]
        let loc = { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } }
        if (first?.type === 'yaml') {
          const fm = readFrontmatter(context.sourceCode, first)
          // YAML that does not parse, or a top level that is no mapping, is a fault of another
          // rule. A block with no content has no `description`.
          if (fm === null && !isEmptyBlock(first.value)) {
            return
          }
          const value = fm?.data.description
          // A value that is not a string is a fault of the schema rule.
          if (
            typeof value === 'string' ? value.trim() !== '' : value !== null && value !== undefined
          ) {
            return
          }
          const field = fm?.fields.get('description')
          loc =
            fm && field ? fm.at(field.keyStart, field.valueEnd) : context.sourceCode.getLoc(first)
        }
        context.report({ loc, messageId: 'missing' })
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
