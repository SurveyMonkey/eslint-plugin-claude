// Content that Claude can work out from the code (docs/rules/claude-md-derivable-content.md).
// The docs list what to leave out of a CLAUDE.md: anything Claude can figure out from the
// code, and file-by-file descriptions of the code base. The rule is a heuristic for three
// shapes. The syntax tree decides what a code block and a list are.
// - A directory tree in a code block: at least three lines that start a branch.
// - A list of dependencies in a code block: a double-quoted `"dependencies"` key of a JSON
//   manifest, a TOML table of dependencies, or at least three lines that pin a package version.
// - A list of at least three items that all describe one file or folder: a code span with a path,
//   then a colon, a dash or the word `is`.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifyMemoryFile } from '../memory-files.ts'

const name = 'claude-md-derivable-content' as const

// A tree line has a branch mark: the box characters `├─` and `└─`, or the plain forms `|--`,
// `+--`, `\--` and "`--". A plain mark starts the line, after any indent, and a name follows it.
// So a table border such as `+----+` is not a branch.
const BRANCH = /(?:[├└]─|^[\s│|]*[|+\\`]--[ \t]+\S)/
const BRANCHES = 3

// The key `dependencies` or `devDependencies` of a manifest, or a TOML table of dependencies.
const DEPENDENCY_KEY =
  /^\s*(?:"(?:dev|peer|optional)?[dD]ependencies"\s*:|\[(?:[\w.-]*\.)?(?:dev-)?dependencies\])/m
// A pinned version, as in `requirements.txt`.
const PIN = /^[\w.-]+\s*(?:==|~=|>=)\s*\d/
const PINS = 3

// A code span with a path: it has a slash or an extension.
const PATH = /^[\w@./-]+$/
// The text after the path: a colon, a dash with a space after it, or a verb.
const DESCRIBES = /^\s*(?::|[-\u2013\u2014]\s|(?:is|holds|contains)\b)/
const FILE_ITEMS = 3

type Tree = { type: string; value?: string; children?: Tree[] }

/** True when the list item describes one file or folder, as `\`src/a.ts\`: the entry`. */
function describesFile(item: Tree): boolean {
  const [first, second] = ((item.children as Tree[])[0]?.children ?? []) as Tree[]
  const path = first?.type === 'inlineCode' ? (first.value as string) : ''
  return (
    PATH.test(path) &&
    (path.includes('/') || /\.\w+$/.test(path)) &&
    second?.type === 'text' &&
    DESCRIBES.test(second.value as string)
  )
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'tree' | 'dependencies' | 'fileList' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Leave out of CLAUDE.md what Claude can work out from the code',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      tree: 'Claude can work out this directory tree from the code. Cut it, or keep only the folders whose use their names do not show.',
      dependencies: 'Claude can read the dependencies from the manifest file. Cut this list.',
      fileList:
        'This list describes the code file by file. Claude can read each file. Cut it, or keep only what the code does not show.',
    },
  },
  create(context) {
    const kind = classifyMemoryFile(context.filename)
    if (kind !== 'claude-md' && kind !== 'claude-local') {
      return {}
    }
    return {
      code(node) {
        const lines = node.value.split('\n')
        if (lines.filter((line) => BRANCH.test(line)).length >= BRANCHES) {
          context.report({ node, messageId: 'tree' })
        } else if (
          DEPENDENCY_KEY.test(node.value) ||
          lines.filter((line) => PIN.test(line)).length >= PINS
        ) {
          context.report({ node, messageId: 'dependencies' })
        }
      },
      list(node) {
        if (node.children.length >= FILE_ITEMS && node.children.every(describesFile)) {
          context.report({ node, messageId: 'fileList' })
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
