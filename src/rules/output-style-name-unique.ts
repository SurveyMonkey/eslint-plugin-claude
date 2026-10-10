// The name of a project output style is its `name` field, or its file name.
// A style in a nested `.claude/output-styles/` directory replaces a style of
// the same name in a directory above it, up to the repository root
// (docs/rules/output-style-name-unique.md). The rule also reports two styles
// of one folder with one name. It reads the styles directly in
// `output-styles/` only: the docs do not say that Claude Code reads subfolders.
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyOutputStyle } from '../agent-files.ts'
import { docsUrl } from '../docs-url.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import {
  entriesOf,
  frontmatterOfFile,
  isInside,
  realDirectory,
  realOf,
  repositoryRoot,
  UNREADABLE,
} from '../skill-tree.ts'

const name = 'output-style-name-unique' as const

/** The style name from the `name` field: the file name for an absent or empty
 *  field, the text for a non-empty string. The result is null for any other
 *  value, which is no name to compare. `output-style-frontmatter-schema`
 *  reports a name that is not a string. */
function styleName(given: unknown, file: string): string | null {
  if (given === undefined || given === null) {
    return path.basename(file).replace(/\.md$/, '')
  }
  return typeof given === 'string' && given !== '' ? given : null
}

/** The style files directly in `dir`, sorted by name. A file or link counts
 *  when its real path is at or below `bound`. The result is empty for a `dir`
 *  that is not there or that the rule cannot list. That can only hide a match. */
function stylesIn(dir: string, bound: string): string[] {
  const entries = entriesOf(dir)
  if (!Array.isArray(entries)) {
    return []
  }
  return entries
    .filter((entry) => entry.name.endsWith('.md') && (entry.isFile() || entry.isSymbolicLink()))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
    .map((entry) => path.join(dir, entry.name))
    .filter((file) => {
      const real = realOf(file)
      return typeof real === 'string' && isInside(real, bound)
    })
}

/** The files of `files` whose style name is `own`, other than `self`. */
function sameName(files: string[], own: string, self: string): string[] {
  return files.filter((file) => {
    if (file === self) {
      return false
    }
    const fields = frontmatterOfFile(file)
    // A file that the rule cannot read has no name to compare. A file with no block, or YAML that
    // does not parse, loads under its file name.
    return fields !== UNREADABLE && styleName(fields?.name, file) === own
  })
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'duplicate' | 'shadows' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Give each project output style its own name',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      duplicate:
        '`{{name}}` is also the name of {{others}}. The docs do not say which of two styles of one name Claude Code uses. Rename one.',
      shadows:
        '`{{name}}` is also the name of {{others}}. Claude Code uses the style closest to the working directory, so this style replaces it in a session that starts in or below this folder. Rename one if that is not your intent.',
    },
  },
  create(context) {
    if (classifyOutputStyle(context.filename)?.plugin !== false) {
      return {}
    }
    const self = path.resolve(context.filename)
    const styles = path.dirname(self)
    const project = path.dirname(path.dirname(styles))
    const bound = repositoryRoot(styles)
    const relative = (files: string[]) =>
      files
        .map((file) => `\`${path.relative(project, file).split(path.sep).join('/')}\``)
        .join(', ')
    return {
      root(node) {
        let given: unknown
        let loc = { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } }
        const first = node.children[0]
        if (first?.type === 'yaml') {
          // Frontmatter that does not parse sets no field. The style loads under its file name.
          const fm = readFrontmatter(context.sourceCode, first)
          if (fm !== null) {
            given = fm.data.name
            const field = fm.fields.get('name')
            if (field !== undefined) {
              loc = fm.at(field.valueStart, field.valueEnd)
            }
          }
        }
        const own = styleName(given, self)
        if (own === null) {
          return
        }
        const same = sameName(stylesIn(styles, bound), own, self)
        if (same.length > 0) {
          context.report({
            loc,
            messageId: 'duplicate',
            data: { name: own, others: relative(same) },
          })
        }
        // Each folder from the parent of this project folder up to the repository root. The
        // walk ends at the first folder out of the repository, or at the root of the file system.
        const above: string[] = []
        for (
          let dir = path.dirname(project);
          dir !== path.dirname(dir) && isInside(realDirectory(dir), bound);
          dir = path.dirname(dir)
        ) {
          above.push(
            ...sameName(stylesIn(path.join(dir, '.claude', 'output-styles'), bound), own, self),
          )
        }
        if (above.length > 0) {
          context.report({
            loc,
            messageId: 'shadows',
            data: { name: own, others: relative(above) },
          })
        }
      },
    }
  },
}

export default { name, language: 'markdown' as const, files: ['**/output-styles/*.md'], rule }
