// A chain of `@path` imports loads to a depth of four hops
// (docs/rules/claude-md-import-max-depth.md). A file at hop five, and each file past it, does
// not load. The rule follows the chain on disk from the linted file, and reports the import of
// that file that starts a chain which is too long. A path that the rule cannot read ends the
// chain there, and gives no report (ADR 001, Decision 14).
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifyMemoryFile } from '../memory-files.ts'
import { followImports, parseImports } from '../memory-imports.ts'
import { repositoryRoot } from '../skill-tree.ts'

const name = 'claude-md-import-max-depth' as const

// The depth in the docs, and the default of `max`: four hops. No setting moves it, so it is
// also the maximum of the option.
const DEPTH = 4

type Options = [{ max: number }]

const rule: MarkdownRuleDefinition<{
  RuleOptions: Options
  MessageIds: 'tooDeep' | 'overConfiguredLimit'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Keep a chain of imports within four hops',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { max: { type: 'integer', minimum: 1, maximum: DEPTH } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ max: DEPTH }],
    messages: {
      tooDeep:
        'This import leads to `{{file}}` at hop {{hop}}. Claude Code loads imports to {{max}} hops only, so it does not load that file.',
      overConfiguredLimit:
        'This import leads to `{{file}}` at hop {{hop}}. The configured limit is {{max}} hops.',
    },
  },
  create(context) {
    // Claude Code never reads a file below `.agents/`, so its imports load nothing.
    if (classifyMemoryFile(context.filename) === 'agents-variant') {
      return {}
    }
    const [{ max }] = context.options
    const { sourceCode } = context
    return {
      root() {
        const file = path.resolve(context.filename)
        const bound = repositoryRoot(path.dirname(file))
        const { tooDeep } = followImports(file, sourceCode.text, bound, max)
        const imports = parseImports(sourceCode.text)
        for (const [index, deep] of tooDeep) {
          const imported = imports[index] as (typeof imports)[number]
          context.report({
            loc: {
              start: sourceCode.getLocFromIndex(imported.index),
              end: sourceCode.getLocFromIndex(imported.index + imported.length),
            },
            // At another value, the message names the configured limit and claims no docs limit.
            messageId: max === DEPTH ? 'tooDeep' : 'overConfiguredLimit',
            data: {
              file: path.relative(bound, deep).split(path.sep).join('/'),
              hop: String(max + 1),
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
