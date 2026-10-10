// An `@path` import in an instruction file must name a file that exists
// (docs/rules/claude-md-import-exists.md). Claude Code resolves a relative path against the
// folder of the file that holds the import. The rule reads the repository around the file.
// It makes no report for a path that it cannot read. Such a path is out of the repository, is a
// dangling link, or has no read right. ADR 001, Decision 14 sets this.
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifyMemoryFile } from '../memory-files.ts'
import { candidates, findImport, parseImports } from '../memory-imports.ts'
import { repositoryRoot } from '../skill-tree.ts'

const name = 'claude-md-import-exists' as const

type Options = [{ ignorePattern?: string }]

/** The expression of the option `ignorePattern`. A pattern that does not compile is a
 *  fault of the configuration. It stops the run with a message. */
function compile(pattern: string): RegExp {
  try {
    return new RegExp(pattern)
  } catch (error) {
    throw new Error(
      `The option "ignorePattern" of ${name} is not a regular expression: ${pattern}`,
      { cause: error },
    )
  }
}

const rule: MarkdownRuleDefinition<{ RuleOptions: Options; MessageIds: 'missing' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Import only files that exist',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { ignorePattern: { type: 'string' } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{}],
    messages: {
      missing:
        'The import `@{{path}}` names no file. Claude Code resolves a relative path from the folder of this file, and loads nothing here. Fix the path. Or write it in backticks if it is not an import.',
    },
  },
  create(context) {
    // Claude Code never reads a file below `.agents/`, so its imports load nothing.
    if (classifyMemoryFile(context.filename) === 'agents-variant') {
      return {}
    }
    const [{ ignorePattern }] = context.options
    const ignore = ignorePattern === undefined ? null : compile(ignorePattern)
    const folder = path.dirname(path.resolve(context.filename))
    const bound = repositoryRoot(folder)
    const { sourceCode } = context
    return {
      root() {
        for (const imported of parseImports(sourceCode.text)) {
          const forms = candidates(imported)
          if (forms.length === 0 || ignore?.test(`@${imported.path}`)) {
            continue
          }
          if (findImport(folder, forms, bound) === 'missing') {
            context.report({
              loc: {
                start: sourceCode.getLocFromIndex(imported.index),
                end: sourceCode.getLocFromIndex(imported.index + imported.length),
              },
              messageId: 'missing',
              data: { path: imported.path },
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
  files: ['**/CLAUDE.md', '**/CLAUDE.local.md', '**/AGENTS.md'],
  rule,
}
