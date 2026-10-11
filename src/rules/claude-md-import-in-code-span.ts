// An `@path` in a code span or a fenced block that names a file
// (docs/rules/claude-md-import-in-code-span.md). Claude Code skips code when it parses imports,
// so the file does not load. A path to a file that exists is probably an import that the writer
// meant. The rule reads the repository around the file, and makes no report for a path that it
// cannot read (ADR 001, Decision 14). A real import is the subject of `claude-md-import-exists`.
// The token is the one that `parseImports` reads, from `importTokens` in `memory-imports.ts`.
import { Stats } from 'node:fs'
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifyMemoryFile } from '../memory-files.ts'
import { candidates, findImport, importTokens } from '../memory-imports.ts'
import { repositoryRoot, statOf } from '../skill-tree.ts'

const name = 'claude-md-import-in-code-span' as const

// The first line of a fenced block, as the syntax tree gives the block. An indented block is text
// to Claude Code, so a path in it is a real import and not the business of this rule.
const FENCE = /^[`~]{3}/

const rule: MarkdownRuleDefinition<{ MessageIds: 'inCode' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not write an @path import that names a file inside code',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      inCode:
        'The text `@{{path}}` is in code, so Claude Code does not import the file. Write it outside code to import it. Keep it in code only to mention the path.',
    },
  },
  create(context) {
    // Claude Code never reads a file below `.agents/`, so its imports load nothing.
    if (classifyMemoryFile(context.filename) === 'agents-variant') {
      return {}
    }
    const folder = path.dirname(path.resolve(context.filename))
    const bound = repositoryRoot(folder)
    const { sourceCode } = context

    /** Report each token of `body`, the text of code that starts at the offset `offset`, that
     *  names a file. */
    function check(body: string, offset: number) {
      for (const imported of importTokens(body)) {
        const forms = candidates(imported)
        const found = forms.length === 0 ? 'missing' : findImport(folder, forms, bound)
        if (typeof found !== 'object') {
          continue
        }
        const info = statOf(found.real)
        if (info instanceof Stats && info.isFile()) {
          const at = offset + imported.index
          context.report({
            loc: {
              start: sourceCode.getLocFromIndex(at),
              end: sourceCode.getLocFromIndex(at + imported.length),
            },
            messageId: 'inCode',
            data: { path: imported.path },
          })
        }
      }
    }

    return {
      inlineCode(node) {
        const raw = sourceCode.getText(node)
        const ticks = raw.length - raw.replace(/^`+/, '').length
        check(raw.slice(ticks, raw.length - ticks), sourceCode.getRange(node)[0] + ticks)
      },
      code(node) {
        const raw = sourceCode.getText(node)
        // The first line holds the fence and the info string. The last line holds the end fence.
        const body = raw.indexOf('\n') + 1
        if (FENCE.test(raw) && body > 0) {
          check(raw.slice(body), sourceCode.getRange(node)[0] + body)
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
