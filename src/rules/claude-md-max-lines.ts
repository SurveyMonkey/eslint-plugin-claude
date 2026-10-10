// The length of an instruction file (docs/rules/claude-md-max-lines.md). The docs set a target of
// 200 lines for a CLAUDE.md file. Claude Code shows a warning at startup and in `/status` for a
// file that is over the recommended length. Each CLAUDE.md, rule file and `@path` import counts
// as a separate file. The rule counts the lines of the linted file, and of each file that its
// imports load, to the depth of four hops. It reads the imports on disk. It makes no report for
// a path that it cannot read (ADR 001, Decision 14).
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifyMemoryFile, isAgentsMd, lineCount } from '../memory-files.ts'
import { followImports, parseImports } from '../memory-imports.ts'
import { repositoryRoot } from '../skill-tree.ts'

const name = 'claude-md-max-lines' as const

// The target in the docs, and the default of `max`. The docs show no setting that moves the
// threshold of the warning, so the schema sets no maximum.
const TARGET = 200

// The depth to which Claude Code loads imports.
const DEPTH = 4

type Options = [{ max: number }]

/** True for a file that this rule, or `rules-max-lines`, lints on its own. An import that leads
 *  to such a file is left to that check, so the rules do not report a file twice. */
function hasOwnCheck(file: string): boolean {
  const kind = classifyMemoryFile(file)
  return kind === 'claude-md' || kind === 'claude-local' || kind === 'rule' || isAgentsMd(file)
}

const rule: MarkdownRuleDefinition<{
  RuleOptions: Options
  MessageIds: 'tooLong' | 'overConfiguredLimit' | 'importTooLong' | 'importOverConfiguredLimit'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Keep an instruction file at or under 200 lines',
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
        'This file has {{size}} lines. Claude Code warns about an instruction file of more than {{max}} lines, and a long file reduces adherence. Move instructions into path-scoped rules.',
      overConfiguredLimit: 'This file has {{size}} lines. The configured limit is {{max}} lines.',
      importTooLong:
        'The file `{{file}}` that this import loads has {{size}} lines. Claude Code warns about an instruction file of more than {{max}} lines. An import does not reduce the context cost.',
      importOverConfiguredLimit:
        'The file `{{file}}` that this import loads has {{size}} lines. The configured limit is {{max}} lines.',
    },
  },
  create(context) {
    const kind = classifyMemoryFile(context.filename)
    if (kind !== 'claude-md' && kind !== 'claude-local' && !isAgentsMd(context.filename)) {
      return {}
    }
    const [{ max }] = context.options
    const { sourceCode } = context
    return {
      root() {
        const size = lineCount(sourceCode.text)
        if (size > max) {
          context.report({
            loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
            // At another value, the message names the configured limit and claims no docs limit.
            messageId: max === TARGET ? 'tooLong' : 'overConfiguredLimit',
            data: { size: String(size), max: String(max) },
          })
        }
        const file = path.resolve(context.filename)
        const bound = repositoryRoot(path.dirname(file))
        const { imported } = followImports(file, sourceCode.text, bound, DEPTH)
        const imports = parseImports(sourceCode.text)
        for (const [real, { text, via }] of imported) {
          const lines = lineCount(text)
          if (lines <= max || hasOwnCheck(real)) {
            continue
          }
          const token = imports[via] as (typeof imports)[number]
          context.report({
            loc: {
              start: sourceCode.getLocFromIndex(token.index),
              end: sourceCode.getLocFromIndex(token.index + token.length),
            },
            messageId: max === TARGET ? 'importTooLong' : 'importOverConfiguredLimit',
            data: {
              file: path.relative(bound, real).split(path.sep).join('/'),
              size: String(lines),
              max: String(max),
            },
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/CLAUDE.md', '**/CLAUDE.local.md', '**/AGENTS.md'],
  rule,
}
