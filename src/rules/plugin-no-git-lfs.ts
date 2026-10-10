// A Git install of a plugin never downloads Git LFS content, so a file that a
// `.gitattributes` pattern sends to LFS arrives as a pointer file
// (docs/rules/plugin-no-git-lfs.md). The rule reads the `.gitattributes` files
// of the repository above the plugin and of the plugin itself, and reports the
// first plugin file that the patterns send to LFS. It reads no file out of the
// repository, so it ignores `.git/info/attributes` and the global attributes
// file. It skips a folder that it cannot list or whose `.gitattributes` it cannot
// read. It makes no report when it cannot read a `.gitattributes` above the
// plugin.
import { lstatSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { readPlugin } from '../plugin-manifest.ts'
import { entriesOf, failure, SKIPPED, UNREADABLE } from '../skill-tree.ts'

const name = 'plugin-no-git-lfs' as const

// A filter attribute: `filter=<value>`, `filter`, `-filter` or `!filter`.
const FILTER = /^[-!]?filter(?:=.*)?$/
// A pattern that the rule does not read: a comment, a macro, a quoted pattern or a negative one.
const NO_FILE = /^(?:#|\[attr\]|"|!)/
const SPECIAL = /[-.*+?^${}()|[\]\\/]/g

/** A line of a `.gitattributes` that sets or clears `filter`. `lfs` is true
 *  when the last filter attribute of the line is `filter=lfs`. `byName` is true
 *  when the pattern has no slash, so it matches the name of a file at any
 *  depth. */
interface AttributeRule {
  readonly lfs: boolean
  readonly pattern: string
  readonly byName: boolean
  readonly regex: RegExp
}

/** A `.gitattributes` file, with the folder that it sits in. */
interface AttributeFile {
  readonly dir: string
  readonly rules: readonly AttributeRule[]
}

/** A plugin file that the patterns send to LFS: the rule that decides it, and
 *  the folder of the `.gitattributes` that holds the rule. */
interface Match {
  readonly rule: AttributeRule
  readonly dir: string
  readonly file: string
}

/** The text of the `.gitattributes` in `dir`, null when it is not a file there,
 *  or `UNREADABLE`. Git ignores a link or a folder of that name. */
function attributesIn(dir: string): string | null | typeof UNREADABLE {
  const file = path.join(dir, '.gitattributes')
  try {
    return lstatSync(file).isFile() ? readFileSync(file, 'utf8') : null
  } catch (error) {
    return failure(error)
  }
}

/** The text as the source of a regular expression that matches it only. */
function literal(text: string): string {
  return text.replace(SPECIAL, '\\$&')
}

/** The class that starts at `glob[from]`, which is `[`, as the source of a
 *  regular expression and the index of its `]`. The result is undefined for a
 *  class with no `]`, and for a POSIX class such as `[:alpha:]`. The rule does
 *  not read either. */
function bracket(glob: string, from: number): { source: string; end: number } | undefined {
  let at = from + 1
  const negated = glob[at] === '!' || glob[at] === '^'
  if (negated) {
    at++
  }
  let body = ''
  // A `]` right after the `[` is a member of the class.
  for (let first = true; at < glob.length; first = false, at++) {
    const ch = glob[at] as string
    if (ch === ']' && !first) {
      return { source: `[${negated ? '^/' : ''}${body}]`, end: at }
    }
    if (ch === '[' && glob[at + 1] === ':') {
      return undefined
    }
    if (ch === '\\') {
      at++
      if (at === glob.length) {
        return undefined
      }
      body += literal(glob[at] as string)
    } else {
      // A hyphen is a range, so it stays as it is.
      body += ch === '-' ? ch : literal(ch)
    }
  }
  return undefined
}

/** The regular expression for the attribute pattern `glob`. `*` and `?` do not
 *  match a slash. `**` matches folders when a slash or an end of the pattern
 *  bounds it on each side. A backslash escapes. The result is undefined for a
 *  pattern that the rule does not read. */
function globToRegExp(glob: string): RegExp | undefined {
  let source = ''
  for (let at = 0; at < glob.length; at++) {
    const ch = glob[at] as string
    if (ch === '*') {
      let end = at
      while (glob[end + 1] === '*') {
        end++
      }
      const startsSegment = at === 0 || glob[at - 1] === '/'
      const endsSegment = end === glob.length - 1 || glob[end + 1] === '/'
      if (end > at && startsSegment && endsSegment) {
        // `**` at the end matches all below. `**/` matches no folder or some.
        source += end === glob.length - 1 ? '.*' : '(?:.*/)?'
        end += end === glob.length - 1 ? 0 : 1
      } else {
        source += '[^/]*'
      }
      at = end
    } else if (ch === '?') {
      source += '[^/]'
    } else if (ch === '[') {
      const found = bracket(glob, at)
      if (found === undefined) {
        return undefined
      }
      source += found.source
      at = found.end
    } else if (ch === '\\') {
      at++
      // A backslash at the end of the pattern escapes nothing.
      if (at === glob.length) {
        return undefined
      }
      source += literal(glob[at] as string)
    } else {
      source += literal(ch)
    }
  }
  try {
    return new RegExp(`^${source}$`)
  } catch {
    // A class with a range out of order, such as `[z-a]`, matches no file in Git.
    return undefined
  }
}

/** The rules of the text of a `.gitattributes`, in file order. A line with no
 *  filter attribute does not change the filter, so it is not here. */
function parse(text: string): AttributeRule[] {
  return text.split(/\r?\n/).flatMap((line) => {
    const [pattern, ...attributes] = line.trim().split(/\s+/) as [string, ...string[]]
    const last = attributes.findLast((attribute) => FILTER.test(attribute))
    if (last === undefined || NO_FILE.test(pattern)) {
      return []
    }
    const byName = !pattern.includes('/')
    const regex = globToRegExp(byName ? pattern : pattern.replace(/^\//, ''))
    return regex === undefined ? [] : [{ lfs: last === 'filter=lfs', pattern, byName, regex }]
  })
}

/** The match for the file `file` when the patterns send it to LFS, or null. The
 *  last rule that matches the file decides. A `.gitattributes` in a deeper
 *  folder comes after the ones above it. */
function sendsToLfs(files: readonly AttributeFile[], file: string): Match | null {
  let decided: Match | undefined
  for (const { dir, rules } of files) {
    const relative = path.relative(dir, file).split(path.sep).join('/')
    for (const rule of rules) {
      if (rule.regex.test(rule.byName ? path.posix.basename(relative) : relative)) {
        decided = { rule, dir, file }
      }
    }
  }
  return decided?.rule.lfs === true ? decided : null
}

/** The first file below `dir`, in name order, that the patterns send to LFS.
 *  The rule cannot judge a file below a folder that it cannot list, or below a
 *  folder with a `.gitattributes` that it cannot read. The walk skips such a
 *  folder. `chain` holds the attribute files of the folders above `dir`, from
 *  the top. */
function findLfs(dir: string, chain: readonly AttributeFile[]): Match | null {
  const entries = entriesOf(dir)
  const text = attributesIn(dir)
  if (!Array.isArray(entries) || text === UNREADABLE) {
    return null
  }
  const files = text === null ? chain : [...chain, { dir, rules: parse(text) }]
  const sorted = entries
    .filter((entry) => !SKIPPED.has(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
  for (const entry of sorted) {
    const full = path.join(dir, entry.name)
    // Git stores a link as a file, so a link to a folder is a file here, and the walk
    // does not enter it.
    const found = entry.isDirectory() ? findLfs(full, files) : sendsToLfs(files, full)
    if (found !== null) {
      return found
    }
  }
  return null
}

/** A path as the message shows it: from `from`, with slashes. */
const shown = (from: string, to: string) => path.relative(from, to).split(path.sep).join('/')

const rule: JSONRuleDefinition<{ MessageIds: 'lfs' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Keep plugin files out of Git LFS',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      lfs: 'The `.gitattributes` pattern `{{pattern}}` in `{{attributes}}` sends `{{file}}` to Git LFS. A Git install never downloads LFS content, so the file arrives as a pointer file. Keep plugin files out of Git LFS.',
    },
  },
  create(context) {
    const plugin = readPlugin(context.filename)
    return {
      Document(node) {
        if (plugin === undefined) {
          return
        }
        // The attribute files above the plugin root, from the top of the repository.
        const above: AttributeFile[] = []
        for (let dir = plugin.realRoot; dir !== plugin.bound; ) {
          dir = path.dirname(dir)
          const text = attributesIn(dir)
          if (text === UNREADABLE) {
            return
          }
          if (text !== null) {
            above.unshift({ dir, rules: parse(text) })
          }
        }
        const found = findLfs(plugin.realRoot, above)
        if (found !== null) {
          context.report({
            node,
            messageId: 'lfs',
            data: {
              pattern: found.rule.pattern,
              attributes: shown(plugin.bound, path.join(found.dir, '.gitattributes')),
              file: shown(plugin.realRoot, found.file),
            },
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/plugin.json'],
  rule,
}
