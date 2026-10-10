// An `AGENTS.md` variant that Claude Code never reads (docs/rules/claude-md-agents-md-variant.md).
// The docs list three: `AGENTS.local.md`, `AGENTS.override.md`, and anything below a `.agents/`
// directory. A repository can keep one of them for another tool. So the option `allow` lists
// the paths to leave out. The rule lints Markdown files below `.agents/` only, because ESLint
// reads no other file type as Markdown.
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifyMemoryFile } from '../memory-files.ts'

const name = 'claude-md-agents-md-variant' as const

type Options = [{ allow: string[] }]

/** A path with forward slashes, no leading `./` and no trailing `/`. */
function normalize(text: string): string {
  return text
    .replaceAll('\\', '/')
    .replace(/^(\.\/)+/, '')
    .replace(/\/+$/, '')
}

const rule: MarkdownRuleDefinition<{ RuleOptions: Options; MessageIds: 'variant' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not keep an AGENTS.md variant that Claude Code never reads',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { allow: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allow: [] }],
    messages: {
      variant:
        'Claude Code never reads this file. Move the text to `CLAUDE.md`, or to `AGENTS.md` if no `CLAUDE.md` file exists. Or list the path in the option `allow` if another tool reads it.',
    },
  },
  create(context) {
    if (classifyMemoryFile(context.filename) !== 'agents-variant') {
      return {}
    }
    const [{ allow }] = context.options
    const relative = normalize(path.relative(context.cwd, context.filename))
    // An entry names a file, or a directory with everything below it.
    if (
      allow.some(
        (entry) => relative === normalize(entry) || relative.startsWith(`${normalize(entry)}/`),
      )
    ) {
      return {}
    }
    return {
      root() {
        context.report({
          loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
          messageId: 'variant',
        })
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/AGENTS.local.md', '**/AGENTS.override.md', '**/.agents/**/*.md'],
  rule,
}
