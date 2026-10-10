// Instruction text in a block-level HTML comment (docs/rules/claude-md-html-comment-content.md).
// Claude Code strips a block-level comment from a CLAUDE.md file before it injects the content,
// and keeps a comment inside a code block. Text that reads as an instruction in such a comment
// never reaches Claude. The rule is a heuristic. It looks for three signs: a modal word in
// capitals, an imperative at the start of the comment or of a sentence, and an `@path` token.
// The walk of the block comments is the one in `memory-index-max-size`: an `html` node whose
// parent holds blocks, and whose text starts with `<!--`.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifyMemoryFile } from '../memory-files.ts'
import { importTokens } from '../memory-imports.ts'

const name = 'claude-md-html-comment-content' as const

// The nodes that hold blocks. An `html` node below another node is inline HTML, in a paragraph.
const CONTAINERS = new Set(['root', 'blockquote', 'list', 'listItem'])

const COMMENT = /<!--([\s\S]*?)(?:-->|$)/g
const MODAL = /\b(?:MUST|NEVER|ALWAYS|IMPORTANT|SHALL|REQUIRED)\b/
const IMPERATIVE =
  /(?:^|[.!?]\s+|\n\s*)(always|never|do not|don't|use|run|prefer|avoid|ensure|make sure|follow)\b/i

/** The text of `body`, the inside of a comment, that reads as an instruction, or null. */
function instructionIn(body: string): string | null {
  const modal = MODAL.exec(body)?.[0]
  if (modal !== undefined) {
    return modal
  }
  const verb = IMPERATIVE.exec(body.trimStart())?.[1]
  if (verb !== undefined) {
    return verb
  }
  // A token with no slash and no dot is more likely a name than a path.
  const token = importTokens(body).find((found) => /[/.]/.test(found.path))
  return token === undefined ? null : `@${token.path}`
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'instruction' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Keep instructions out of a block-level HTML comment',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      instruction:
        'This block-level HTML comment holds text that reads as an instruction: `{{found}}`. Claude Code strips the comment before it injects the file, so Claude never sees the text. Move the text out of the comment, or reword the note for maintainers.',
    },
  },
  create(context) {
    const kind = classifyMemoryFile(context.filename)
    if (kind !== 'claude-md' && kind !== 'claude-local') {
      return {}
    }
    return {
      html(node, parent) {
        // An `html` node always has a parent.
        const holder = (parent as { type: string }).type
        if (!CONTAINERS.has(holder) || !node.value.trimStart().startsWith('<!--')) {
          return
        }
        for (const comment of node.value.matchAll(COMMENT)) {
          const found = instructionIn(comment[1] as string)
          if (found !== null) {
            context.report({ node, messageId: 'instruction', data: { found } })
            return
          }
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
