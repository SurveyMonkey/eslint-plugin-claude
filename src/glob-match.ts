// Match the `paths` globs of a rule file against the files on disk, for a rule that checks that a
// glob can match. The docs name the forms: `**/*.ts`, `src/**/*`, `*.md` (the project root only),
// `src/components/*.tsx` and brace groups such as `src/**/*.{ts,tsx}`
// (https://code.claude.com/docs/en/memory#path-specific-rules). They do not give the full
// syntax. So the matcher is wide where the docs are silent, and a glob that it takes for a match
// is not reported. These choices follow:
// - A glob is relative to the root of the project. A `./` or `/` at the start is dropped.
// - `*` and `?` match a dot file. `*` does not cross a `/`.
// - A glob that names a folder matches the files below the folder. A `/` at the end is the same.
// - A brace group without a comma stays as text.
// The walk of the files is bounded at the repository root, skips `.git` and `node_modules`, and
// follows a link to a folder under each name, and ends a link cycle.
import { Stats } from 'node:fs'
import path from 'node:path'
import { entriesOf, isInside, realOf, statOf, UNREADABLE } from './skill-tree.ts'

// Directories that hold no files that a glob names, and can be very large.
const SKIPPED = new Set(['.git', 'node_modules'])

const SPECIAL = /[\\^$.|+()[\]{}*?]/

/** The index of the `}` that closes the `{` at `open`, or -1. A backslash escapes a character. */
function closeOf(glob: string, open: number): number {
  let depth = 0
  for (let i = open; i < glob.length; i++) {
    if (glob[i] === '\\') {
      i++
    } else if (glob[i] === '{') {
      depth++
    } else if (glob[i] === '}' && --depth === 0) {
      return i
    }
  }
  return -1
}

/** The parts of `inner` between the commas that are not in a brace group. */
function splitTop(inner: string): string[] {
  const parts: string[] = []
  let depth = 0
  let from = 0
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '\\') {
      i++
    } else if (inner[i] === '{') {
      depth++
    } else if (inner[i] === '}') {
      depth--
    } else if (inner[i] === ',' && depth === 0) {
      parts.push(inner.slice(from, i))
      from = i + 1
    }
  }
  return [...parts, inner.slice(from)]
}

/** The bracket expression that starts at `open`, as a pattern, and the index after it. The
 *  result is null when the `[` has no `]`. */
function bracket(glob: string, open: number): { source: string; next: number } | null {
  let i = open + 1
  const negated = glob[i] === '!' || glob[i] === '^'
  if (negated) {
    i++
  }
  let members = ''
  // A `]` right after the `[` is a member.
  for (let first = true; i < glob.length && (glob[i] !== ']' || first); first = false) {
    const ch = glob[i] === '\\' ? (glob[++i] ?? '\\') : (glob[i] as string)
    members += ch === '\\' || ch === ']' || ch === '[' || ch === '^' ? `\\${ch}` : ch
    i++
  }
  return i < glob.length ? { source: `[${negated ? '^' : ''}${members}]`, next: i + 1 } : null
}

/** The source of a regular expression for the glob `glob`. */
function translate(glob: string): string {
  let out = ''
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i] as string
    if (ch === '\\') {
      const next = glob[i + 1] ?? '\\'
      out += SPECIAL.test(next) ? `\\${next}` : next
      i++
    } else if (ch === '*') {
      if (glob[i + 1] === '*' && (i === 0 || glob[i - 1] === '/')) {
        const slash = glob[i + 2] === '/'
        // `**/` matches no folder or some folders. `**` at the end matches anything.
        out += slash ? '(?:.*/)?' : '.*'
        i += slash ? 2 : 1
      } else {
        // A second `*` that is not alone in its part acts as one.
        while (glob[i + 1] === '*') {
          i++
        }
        out += '[^/]*'
      }
    } else if (ch === '?') {
      out += '[^/]'
    } else if (ch === '[') {
      const found = bracket(glob, i)
      out += found?.source ?? '\\['
      i = found === null ? i : found.next - 1
    } else if (ch === '{') {
      const close = closeOf(glob, i)
      const inner = close === -1 ? '' : glob.slice(i + 1, close)
      const parts = splitTop(inner)
      if (close === -1) {
        out += '\\{'
      } else if (parts.length > 1) {
        out += `(?:${parts.map(translate).join('|')})`
        i = close
      } else {
        out += `\\{${translate(inner)}\\}`
        i = close
      }
    } else {
      out += SPECIAL.test(ch) ? `\\${ch}` : ch
    }
  }
  return out
}

/** A regular expression for `glob`, or null when the glob builds none, such as a reversed range
 *  in a bracket. The glob is relative to the project root. */
function globRegExp(glob: string): RegExp | null {
  const bare = glob.replace(/^(?:\.?\/)+/, '')
  if (bare === '') {
    // The project root holds every file.
    return /^/
  }
  try {
    return new RegExp(`^${translate(bare.endsWith('/') ? `${bare}**` : bare)}$`)
  } catch {
    return null
  }
}

/** True when `matcher` matches the path `relative`, or a folder above it. A path uses `/`. */
function matchesPath(matcher: RegExp, relative: string): boolean {
  for (let at = relative.length; at > 0; at = relative.lastIndexOf('/', at - 1)) {
    if (matcher.test(relative.slice(0, at))) {
      return true
    }
  }
  return false
}

/** Walk the files below `root`. `visit` gets the path of each file, relative to `root`, with
 *  `/` as separator. It returns true to stop the walk. A link to a folder is followed when its
 *  real path is in `bound`, and when it is not one of the folders above it (a cycle). The result is true when the walk could not see a part of the
 *  tree: a folder that cannot be read, or a link that leads out of `bound`. */
function walkFiles(root: string, bound: string, visit: (relative: string) => boolean) {
  let unreadable = false
  let stopped = false
  const walk = (dir: string, relative: string, above: string[]): void => {
    const real = realOf(dir)
    if (typeof real !== 'string') {
      // A folder that is gone or cannot be read may hide any file.
      unreadable = true
      return
    }
    if (above.includes(real)) {
      return
    }
    const entries = entriesOf(dir)
    if (!Array.isArray(entries)) {
      unreadable ||= entries === UNREADABLE
      return
    }
    for (const entry of entries) {
      if (stopped || SKIPPED.has(entry.name)) {
        continue
      }
      const full = path.join(dir, entry.name)
      const rel = relative === '' ? entry.name : `${relative}/${entry.name}`
      let isDirectory = entry.isDirectory()
      if (entry.isSymbolicLink()) {
        const target = realOf(full)
        if (typeof target !== 'string') {
          // A broken link is no file. A link that fails to read may hide any file.
          unreadable ||= target === UNREADABLE
          continue
        }
        if (!isInside(target, bound)) {
          unreadable = true
          continue
        }
        const info = statOf(target)
        isDirectory = info instanceof Stats && info.isDirectory()
      }
      if (isDirectory) {
        walk(full, rel, [...above, real])
      } else {
        stopped = visit(rel)
      }
    }
  }
  walk(root, '', [])
  return unreadable
}

/** The globs of `globs` that match no file below `root`, or null when the walk could not see
 *  all of the tree and a glob is left. */
export function unmatchedGlobs(root: string, bound: string, globs: string[]): string[] | null {
  // A glob that builds no expression is not reported: the rule cannot tell what it matches.
  let left = globs.flatMap((glob) => {
    const matcher = globRegExp(glob)
    return matcher === null ? [] : [{ glob, matcher }]
  })
  const unreadable = walkFiles(root, bound, (relative) => {
    left = left.filter(({ matcher }) => !matchesPath(matcher, relative))
    return left.length === 0
  })
  return unreadable && left.length > 0 ? null : left.map(({ glob }) => glob)
}
