// The size of an instruction file that loads on demand (docs/rules/claude-md-on-demand-max-chars.md).
// When such a file is over a per-file limit, Claude gets only the start of it. These files load
// on demand: a CLAUDE.md or CLAUDE.local.md in a subfolder of the start folder, and the files
// that they import; a rule file in the `.claude/rules/` of a subfolder; and a rule file with
// `paths` in the project `.claude/rules/`. The start folder is the git top above the folder that
// holds the file, else that folder, as in `claude-md-combined-size`. The rule counts characters
// as `wc -m` does: one for each code point. It makes no report for a path that it cannot read,
// and it does not read `~/.claude/rules/` (ADR 001, Decision 14).
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifyMemoryFile, isScopedRule } from '../memory-files.ts'
import { followImports, gitTop, parseImports } from '../memory-imports.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import { repositoryRoot } from '../skill-tree.ts'

const name = 'claude-md-on-demand-max-chars' as const

// The limit of a 200K context window, and the default of `max`. The limit of a 1M context window
// is larger, and the model setting picks the window. So the schema sets no maximum.
const LIMIT = 40000

// The depth to which Claude Code loads imports.
const DEPTH = 4

// A code point above U+FFFF, which a JavaScript string holds as two code units.
const PAIR = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g

type Options = [{ max: number }]

/** The number of characters in `text`, as `wc -m` counts them in a UTF-8 locale. */
function charCount(text: string): number {
  return text.length - (text.match(PAIR)?.length ?? 0)
}

/** The folder that a memory file belongs to. For a rule file, it is the folder that holds the
 *  nearest `.claude/rules/` above the file. For a CLAUDE.md file in `.claude/`, it is the folder
 *  that holds `.claude/`. For another CLAUDE.md file, it is the folder of the file. */
function homeOf(file: string, rule: boolean): string {
  let dir = path.dirname(file)
  if (rule) {
    // `classifyMemoryFile` found a `.claude/rules/` above the file, so the loop ends.
    while (path.basename(dir) !== 'rules' || path.basename(path.dirname(dir)) !== '.claude') {
      dir = path.dirname(dir)
    }
    return path.dirname(path.dirname(dir))
  }
  return path.basename(dir) === '.claude' ? path.dirname(dir) : dir
}

/** True for an imported file that this rule lints on its own, or that loads at launch. The rule
 *  leaves it, so that it does not report a file twice. */
function isMemoryFile(file: string): boolean {
  const kind = classifyMemoryFile(file)
  return kind === 'claude-md' || kind === 'claude-local' || kind === 'rule'
}

const rule: MarkdownRuleDefinition<{
  RuleOptions: Options
  MessageIds: 'tooLong' | 'overConfiguredLimit' | 'importTooLong' | 'importOverConfiguredLimit'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Keep an instruction file that loads on demand at or under 40,000 characters',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          max: { description: 'The most characters in the file.', type: 'integer', minimum: 1 },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ max: LIMIT }],
    messages: {
      tooLong:
        'This file loads on demand and has {{size}} characters. Claude gets only the start of an on-demand file of more than {{max}} characters. Trim the file, or move part of it into rules files.',
      overConfiguredLimit:
        'This file loads on demand and has {{size}} characters. The configured limit is {{max}} characters.',
      importTooLong:
        'The file `{{file}}` that this import loads on demand has {{size}} characters. Claude gets only the start of an on-demand file of more than {{max}} characters.',
      importOverConfiguredLimit:
        'The file `{{file}}` that this import loads on demand has {{size}} characters. The configured limit is {{max}} characters.',
    },
  },
  create(context) {
    const kind = classifyMemoryFile(context.filename)
    if (kind !== 'claude-md' && kind !== 'claude-local' && kind !== 'rule') {
      return {}
    }
    const [{ max }] = context.options
    const { sourceCode } = context
    const file = path.resolve(context.filename)
    const home = homeOf(file, kind === 'rule')
    const nested = home !== (gitTop(home) ?? home)
    let scoped = false
    return {
      yaml(node) {
        scoped = isScopedRule(readFrontmatter(sourceCode, node)?.data.paths)
      },
      'root:exit'() {
        // A project rule with no `paths` loads at launch, and so does the root CLAUDE.md file.
        if (!nested && !(kind === 'rule' && scoped)) {
          return
        }
        const size = charCount(sourceCode.text)
        if (size > max) {
          context.report({
            loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
            // At another value, the message names the configured limit and claims no docs limit.
            messageId: max === LIMIT ? 'tooLong' : 'overConfiguredLimit',
            data: { size: String(size), max: String(max) },
          })
        }
        // The docs name the imports of a CLAUDE.md file, and not those of a rule file.
        if (kind === 'rule') {
          return
        }
        const bound = repositoryRoot(home)
        const { imported } = followImports(file, sourceCode.text, bound, DEPTH)
        const imports = parseImports(sourceCode.text)
        for (const [real, { text, via }] of imported) {
          const chars = charCount(text)
          if (chars <= max || isMemoryFile(real)) {
            continue
          }
          const token = imports[via] as (typeof imports)[number]
          context.report({
            loc: {
              start: sourceCode.getLocFromIndex(token.index),
              end: sourceCode.getLocFromIndex(token.index + token.length),
            },
            messageId: max === LIMIT ? 'importTooLong' : 'importOverConfiguredLimit',
            data: {
              file: path.relative(bound, real).split(path.sep).join('/'),
              size: String(chars),
              max: String(max),
            },
          })
        }
      },
    }
  },
}

export const target = {
  name,
  language: 'markdown' as const,
  files: ['**/CLAUDE.md', '**/CLAUDE.local.md', '**/.claude/rules/**/*.md'],
}

export default rule
