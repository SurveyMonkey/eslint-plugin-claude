// The combined length of the files that load at launch (docs/rules/claude-md-combined-size.md).
// Claude Code warns when instruction files that are each within the recommended length add up
// past a combined limit at session start. The docs give no number, so the rule has the option
// `max` and no default. It makes no report when `max` is not set. The set is the CLAUDE.md files
// of the folder of the linted file and of each folder above it, up to the repository root, the
// rule files with no `paths`, and the files that their imports load. A file counts once. A part
// that the rule cannot read adds nothing. A sum can only grow, so the rule reports when the lines
// that it did read pass `max`, and stays silent when they do not (ADR 001, Decision 14).
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifyMemoryFile, isScopedRule, lineCount } from '../memory-files.ts'
import { followImports, gitTop, locate, readImported } from '../memory-imports.ts'
import {
  frontmatterOfFile,
  markdownFiles,
  realOf,
  repositoryRoot,
  UNREADABLE,
} from '../skill-tree.ts'

const name = 'claude-md-combined-size' as const

// The depth to which Claude Code loads imports.
const DEPTH = 4

// The files of a folder that load at launch, in the order of the docs. The first one that exists
// is the file that reports for the folder.
const MEMORY_FILES = ['CLAUDE.md', '.claude/CLAUDE.md', 'CLAUDE.local.md']

type Options = [{ max?: number }]

/** The file that ESLint lints. Its text is the one that counts, not the text on disk. */
interface Linted {
  file: string
  text: string
}

/** What `addFolder` finds in a folder. */
interface Folder {
  /** The file that reports for the folder, or null when the folder holds none. */
  first: string | null
  unreadable: boolean
}

/** The set of real paths that are counted, and the sum of their lines. */
interface Total {
  seen: Set<string>
  lines: number
}

/** The real path and the text of the file at `candidate`: null when it is not there or is
 *  a folder, and `UNREADABLE` when the rule cannot read it. The linted file is read from its
 *  text, also when it is not on disk. */
function load(
  candidate: string,
  bound: string,
  linted: Linted,
): { real: string; text: string } | null | typeof UNREADABLE {
  if (path.resolve(candidate) === linted.file) {
    const real = realOf(candidate)
    return { real: typeof real === 'string' ? real : linted.file, text: linted.text }
  }
  const found = locate(candidate, bound)
  if (typeof found !== 'object') {
    return found === UNREADABLE ? UNREADABLE : null
  }
  const text = readImported(found.real)
  return typeof text === 'string' ? { real: found.real, text } : text
}

type Loaded = ReturnType<typeof load>

/** Add the file `found`, which `load` read at `candidate`, and the files that its imports load,
 *  to `total`. The result is false when the rule cannot read a part of them. */
function add(candidate: string, found: Loaded, bound: string, total: Total): boolean {
  if (found === UNREADABLE) {
    return false
  }
  if (found === null || total.seen.has(found.real)) {
    return true
  }
  total.seen.add(found.real)
  total.lines += lineCount(found.text)
  const chain = followImports(candidate, found.text, bound, DEPTH)
  for (const [real, { text }] of chain.imported) {
    if (!total.seen.has(real)) {
      total.seen.add(real)
      total.lines += lineCount(text)
    }
  }
  return !chain.unreadable
}

/** Add the files of the folder `dir` to `total`: its CLAUDE.md files, and the rule files below
 *  `.claude/rules/` that set no scope. */
function addFolder(dir: string, bound: string, linted: Linted, total: Total): Folder {
  const folder: Folder = { first: null, unreadable: false }
  for (const memory of MEMORY_FILES) {
    const candidate = path.join(dir, memory)
    const found = load(candidate, bound, linted)
    // A file that the rule cannot read is not the one that reports: ESLint cannot lint it.
    if (found !== null && found !== UNREADABLE) {
      folder.first ??= path.resolve(candidate)
    }
    // `add` runs first: a part that fails to read must not stop the count of the next one.
    folder.unreadable = !add(candidate, found, bound, total) || folder.unreadable
  }
  const scan = markdownFiles(path.join(dir, '.claude', 'rules'), bound)
  folder.unreadable ||= scan.unreadable || scan.outside
  for (const file of scan.files) {
    const fields = frontmatterOfFile(file)
    if (fields === UNREADABLE) {
      folder.unreadable = true
    } else if (!isScopedRule(fields?.paths)) {
      folder.unreadable = !add(file, load(file, bound, linted), bound, total) || folder.unreadable
    }
  }
  return folder
}

const rule: MarkdownRuleDefinition<{ RuleOptions: Options; MessageIds: 'tooLong' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Keep the files that load at launch within a combined number of lines',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { max: { type: 'integer', minimum: 1 } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{}],
    messages: {
      tooLong:
        'The files that load at launch with this file have {{size}} lines. The configured limit is {{max}} lines. Claude Code warns when instruction files add up past a combined limit. Move instructions into path-scoped rules.',
    },
  },
  create(context) {
    const [{ max }] = context.options
    const kind = classifyMemoryFile(context.filename)
    if (max === undefined || (kind !== 'claude-md' && kind !== 'claude-local')) {
      return {}
    }
    const { sourceCode } = context
    return {
      root() {
        const file = path.resolve(context.filename)
        const linted: Linted = { file, text: sourceCode.text }
        // A file in `.claude/` belongs to the folder that holds `.claude/`.
        const here = path.dirname(file)
        const home = path.basename(here) === '.claude' ? path.dirname(here) : here
        const bound = repositoryRoot(home)
        const top = gitTop(home) ?? home
        const folders: string[] = []
        for (let dir = home; ; dir = path.dirname(dir)) {
          folders.unshift(dir)
          if (dir === top) {
            break
          }
        }
        const total: Total = { seen: new Set(), lines: 0 }
        let before = 0
        let last: Folder = { first: null, unreadable: false }
        let unreadable = false
        for (const dir of folders) {
          before = total.lines
          last = addFolder(dir, bound, linted, total)
          unreadable ||= last.unreadable
        }
        // The folder that takes the sum past `max` reports. The folders below it do not.
        if (last.first !== file || before > max || total.lines <= max) {
          return
        }
        context.report({
          loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
          messageId: 'tooLong',
          data: { size: `${unreadable ? 'at least ' : ''}${total.lines}`, max: String(max) },
        })
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
