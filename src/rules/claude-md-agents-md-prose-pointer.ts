// A CLAUDE.md that tells Claude in words to read `AGENTS.md`
// (docs/rules/claude-md-agents-md-prose-pointer.md). Claude then sees the file only if it decides
// to open it. The docs say to delete the CLAUDE.md, or to replace the sentence with an
// `@AGENTS.md` import. The rule is a heuristic. It reads the text of each paragraph, and makes no
// report when the file has a real import of an `AGENTS.md`. An import in code does not count.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifyMemoryFile } from '../memory-files.ts'
import { parseImports } from '../memory-imports.ts'

const name = 'claude-md-agents-md-prose-pointer' as const

// A verb such as `read`, then the name of the file on the same line, within 80 characters and
// with no `.`, `!` or `?` between them. The verb is in any case. The name is `AGENTS.md` in capitals, and no longer name follows it.
const POINTER =
  /\b(?:read|see|refer to|follow|consult|check|open|load|look at)\b[^\n.!?]{0,80}?\b(AGENTS\.md)(?![\w-]|\.\w)/gi

/** True when `text` tells the reader to read `AGENTS.md`. */
function hasPointer(text: string): boolean {
  return [...text.matchAll(POINTER)].some((match) => match[1] === 'AGENTS.md')
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'prose' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Import AGENTS.md with @AGENTS.md instead of a sentence that points to it',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      prose:
        'This sentence tells Claude to read AGENTS.md, and Claude opens the file only if it decides to. Replace the sentence with an `@AGENTS.md` import, or delete this CLAUDE.md so that Claude reads AGENTS.md directly.',
    },
  },
  create(context) {
    if (classifyMemoryFile(context.filename) !== 'claude-md') {
      return {}
    }
    const { sourceCode } = context
    let reported = false
    return {
      paragraph(node) {
        if (reported || !hasPointer(sourceCode.getText(node))) {
          return
        }
        const imported = parseImports(sourceCode.text).some(
          (found) => found.path.split('/').pop() === 'AGENTS.md',
        )
        if (!imported) {
          reported = true
          context.report({ node, messageId: 'prose' })
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/CLAUDE.md'],
  rule,
}
