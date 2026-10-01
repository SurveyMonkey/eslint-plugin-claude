// Claude Code reads skill frontmatter only when the opening `---` is line 1
// (docs/rules/skill-frontmatter-position.md). `@eslint/markdown` gives no
// `yaml` node for a block below line 1, so the rule reads the lines.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { SKILL_FIELDS } from '../data/skill-fields.ts'
import { docsUrl } from '../docs-url.ts'
import { parseFrontmatter } from '../frontmatter.ts'
import { unfencedLines } from '../markdown-lines.ts'
import { classifySkillFile } from '../skill-files.ts'

const name = 'skill-frontmatter-position' as const

const OPEN = /^---\s*$/
const CLOSE = /^(---|\.\.\.)\s*$/

const rule: MarkdownRuleDefinition<{ MessageIds: 'notFirst' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Put the frontmatter of a skill on line 1',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      notFirst:
        'This frontmatter block does not start on line 1. Claude Code reads it as skill content, and sets no field.',
    },
  },
  create(context) {
    if (classifySkillFile(context.filename) === null) {
      return {}
    }
    const { sourceCode } = context
    return {
      root(node) {
        if (node.children[0]?.type === 'yaml') {
          return
        }
        const lines = unfencedLines(sourceCode)
        const opening = lines.find((l) => OPEN.test(l.text))
        const closing = lines.find((l) => l.line > (opening?.line ?? 0) && CLOSE.test(l.text))
        if (opening === undefined || closing === undefined) {
          return
        }
        const between = sourceCode.lines.slice(opening.line, closing.line - 1)
        const data = parseFrontmatter(between.join('\n'))
        if (data === null || !SKILL_FIELDS.some((field) => field in data)) {
          return
        }
        context.report({
          loc: {
            start: { line: opening.line, column: 1 },
            end: { line: opening.line, column: opening.text.length + 1 },
          },
          messageId: 'notFirst',
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
