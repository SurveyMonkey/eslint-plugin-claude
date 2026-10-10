// An `@path` import that leads out of the repository (docs/rules/claude-md-import-external.md).
// The docs say that an import in a project memory file is external when its path resolves
// outside the working directory. Claude Code asks each user to approve it, and a decline
// disables the import for good. The rule reads the path as it is written, so it needs no file
// of the target. It follows the imports on disk, and checks the imports of each file that loads.
// The end of the repository is the first folder with a `.git`. With no `.git`, the rule makes
// no report (ADR 001, Decision 14).
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifyMemoryFile } from '../memory-files.ts'
import {
  candidates,
  followImports,
  gitTop,
  type MemoryImport,
  parseImports,
} from '../memory-imports.ts'
import { isInside, repositoryRoot } from '../skill-tree.ts'

const name = 'claude-md-import-external' as const

// The depth to which Claude Code loads imports.
const DEPTH = 4

// A Windows drive path. The parser reads a word with a colon as text, so this form needs its
// own test. A path with a backslash ends at the first backslash, so only the slash form counts.
const DRIVE = /^[a-z]:\//i

/** True when the import `imported` of a file in `dir` leads out of `top`. A word with a colon
 *  and a path of the form `~name` are text. The home path is `~` or starts with `~/`. */
function isExternal(imported: MemoryImport, dir: string, top: string): boolean {
  const written = imported.path
  if (written === '~' || written.startsWith('~/') || DRIVE.test(written)) {
    return true
  }
  // A path is inside when any of its forms is, as in `claude-md-import-exists`.
  const forms = candidates(imported)
  return forms.length > 0 && forms.every((form) => !isInside(path.resolve(dir, form), top))
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'external' | 'externalInImported' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not import a file from outside the repository',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      external:
        'The import `@{{path}}` leads out of the repository. Claude Code asks each user to approve it, and a decline disables it for good. Copy the file into the repository, or import it from a personal file.',
      externalInImported:
        'This import loads `{{file}}`, which holds the import `@{{path}}` out of the repository. Claude Code asks each user to approve it, and a decline disables it for good.',
    },
  },
  create(context) {
    // An `AGENTS.md` that the setting reads never prompts, and a `CLAUDE.local.md` is not committed.
    if (classifyMemoryFile(context.filename) !== 'claude-md') {
      return {}
    }
    const file = path.resolve(context.filename)
    const top = gitTop(path.dirname(file))
    // With no `.git`, the end of the repository is not known.
    if (top === null) {
      return {}
    }
    const bound = repositoryRoot(path.dirname(file))
    const { sourceCode } = context
    const locOf = (token: MemoryImport) => ({
      start: sourceCode.getLocFromIndex(token.index),
      end: sourceCode.getLocFromIndex(token.index + token.length),
    })
    return {
      root() {
        const imports = parseImports(sourceCode.text)
        for (const imported of imports) {
          if (isExternal(imported, path.dirname(file), top)) {
            context.report({
              loc: locOf(imported),
              messageId: 'external',
              data: { path: imported.path },
            })
          }
        }
        const chain = followImports(file, sourceCode.text, bound, DEPTH)
        for (const [real, { text, via }] of chain.imported) {
          // A CLAUDE.md is checked on its own. The imports of a file at the last hop do not load.
          if (classifyMemoryFile(real) === 'claude-md' || chain.loaded.get(real) === DEPTH) {
            continue
          }
          for (const imported of parseImports(text)) {
            if (isExternal(imported, path.dirname(real), bound)) {
              context.report({
                loc: locOf(imports[via] as MemoryImport),
                messageId: 'externalInImported',
                data: {
                  path: imported.path,
                  file: path.relative(bound, real).split(path.sep).join('/'),
                },
              })
            }
          }
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
