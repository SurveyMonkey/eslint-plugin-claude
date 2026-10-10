// The skills page says to keep `SKILL.md` under 500 lines (docs/rules/skill-max-lines.md). Claude
// Code does not cut the file at that number, so the option `max` has no schema maximum.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifySkillFile } from '../skill-files.ts'

const name = 'skill-max-lines' as const

// The number from the skills page, and the default of `max`.
const DOCS_LINES = 500

type Options = [{ max: number; countFrontmatter: boolean }]

const rule: MarkdownRuleDefinition<{
  RuleOptions: Options
  MessageIds: 'overDocsLimit' | 'overConfiguredLimit'
}> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Keep a SKILL.md under a number of lines',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          max: { type: 'integer', minimum: 1 },
          countFrontmatter: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ max: DOCS_LINES, countFrontmatter: true }],
    messages: {
      overDocsLimit:
        'This file has {{count}} lines. The skills page says to keep `SKILL.md` under {{max}} lines. Move reference material to supporting files.',
      overConfiguredLimit:
        'This file has {{count}} lines. The configured limit is under {{max}} lines. Move reference material to supporting files.',
    },
  },
  create(context) {
    const [{ max, countFrontmatter }] = context.options
    // A command file also has the name `SKILL.md` when it sits below `commands/`.
    if (classifySkillFile(context.filename)?.kind !== 'skill') {
      return {}
    }
    const { sourceCode } = context
    return {
      root(node) {
        const first = node.children[0]
        // The line break at the end of the file does not start a line.
        const total = sourceCode.lines.length - (sourceCode.lines.at(-1) === '' ? 1 : 0)
        const skipped =
          !countFrontmatter && first?.type === 'yaml' ? sourceCode.getLoc(first).end.line : 0
        const count = total - skipped
        if (count >= max) {
          context.report({
            loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
            messageId: max === DOCS_LINES ? 'overDocsLimit' : 'overConfiguredLimit',
            data: { count: String(count), max: String(max) },
          })
        }
      },
    }
  },
}

export default { name, language: 'markdown' as const, files: ['**/SKILL.md'], rule }
