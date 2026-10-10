// The size of a CLAUDE.md file (docs/rules/claude-md-max-bytes.md). The docs say that
// Claude Code loads a CLAUDE.md file of up to 4 MiB in full and skips a larger file. No
// Claude Code setting moves that number. So the schema sets it as the maximum of the
// option `max`. The rule counts the UTF-8 bytes of the text that ESLint gives it. ESLint
// removes a byte order mark first, so the rule does not count its 3 bytes. The docs name
// CLAUDE.md files only, so the rule leaves `AGENTS.md` out.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifyMemoryFile } from '../memory-files.ts'

const name = 'claude-md-max-bytes' as const

// The limit in the docs, and the default of `max`: 4 MiB.
const FILE_MAX = 4194304

type Options = [{ max: number }]

const rule: MarkdownRuleDefinition<{
  RuleOptions: Options
  MessageIds: 'tooLarge' | 'overConfiguredLimit'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Keep a CLAUDE.md file at or under 4 MiB',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { max: { type: 'integer', minimum: 1, maximum: FILE_MAX } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ max: FILE_MAX }],
    messages: {
      tooLarge:
        'This file has {{size}} bytes. Claude Code skips a CLAUDE.md file of more than {{max}} bytes.',
      overConfiguredLimit: 'This file has {{size}} bytes. The configured limit is {{max}} bytes.',
    },
  },
  create(context) {
    const kind = classifyMemoryFile(context.filename)
    if (kind !== 'claude-md' && kind !== 'claude-local') {
      return {}
    }
    const [{ max }] = context.options
    return {
      root() {
        const size = Buffer.byteLength(context.sourceCode.text, 'utf8')
        if (size > max) {
          context.report({
            loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
            // At another value, the message names the configured limit and claims no docs limit.
            messageId: max === FILE_MAX ? 'tooLarge' : 'overConfiguredLimit',
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
  files: ['**/CLAUDE.md', '**/CLAUDE.local.md'],
  rule,
}
