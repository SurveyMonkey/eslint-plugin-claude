// The length of a rule file (docs/rules/rules-max-lines.md). The docs set a target of 200 lines
// for an instruction file. Claude Code shows a warning for a file that is over the recommended
// length, and each rules file counts as a separate file. The rule counts the lines of each file
// below `.claude/rules/`.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifyMemoryFile, lineCount } from '../memory-files.ts'

const name = 'rules-max-lines' as const

// The target in the docs, and the default of `max`. The docs show no setting that moves the
// threshold of the warning, so the schema sets no maximum.
const TARGET = 200

type Options = [{ max: number }]

const rule: MarkdownRuleDefinition<{
  RuleOptions: Options
  MessageIds: 'tooLong' | 'overConfiguredLimit'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Keep a rule file at or under 200 lines',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { max: { type: 'integer', minimum: 1 } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ max: TARGET }],
    messages: {
      tooLong:
        'This rule file has {{size}} lines. Claude Code warns about an instruction file of more than {{max}} lines, and a long file reduces adherence. Split the rule into more files.',
      overConfiguredLimit: 'This file has {{size}} lines. The configured limit is {{max}} lines.',
    },
  },
  create(context) {
    if (classifyMemoryFile(context.filename) !== 'rule') {
      return {}
    }
    const [{ max }] = context.options
    return {
      root() {
        const size = lineCount(context.sourceCode.text)
        if (size > max) {
          context.report({
            loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
            // At another value, the message names the configured limit and claims no docs limit.
            messageId: max === TARGET ? 'tooLong' : 'overConfiguredLimit',
            data: { size: String(size), max: String(max) },
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/.claude/rules/**/*.md'],
  rule,
}
