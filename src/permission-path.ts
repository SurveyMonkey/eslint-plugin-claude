// The path rules `Read(path)`, `Edit(path)` and `Cd(path)`. The permissions page
// (https://code.claude.com/docs/en/permissions#read-and-edit) gives `Read` and `Edit` rules the
// syntax of a gitignore pattern. It gives `Cd` the same anchors, and matches the whole path.
// The rules for these specifiers share the helpers below. The grammar of the rule itself is in
// `permission-rule.ts`.
import { type ParsedEntry, parameterOf } from './permission-entries.ts'

/** The tools whose specifier is a gitignore pattern. */
export const GITIGNORE_TOOLS: readonly string[] = ['Read', 'Edit']

/** The tools whose specifier is a path. `Cd` shares the anchors of `Read` and `Edit`. */
export const PATH_TOOLS: readonly string[] = [...GITIGNORE_TOOLS, 'Cd']

/** The specifier of `entry` when it is a path of one of `tools`, or null. A deny or ask rule can
 *  be a parameter rule, as `Read(offset:5)`, and `permissions-param-rule` reads that. A path
 *  can start with a drive letter, as `C:\Users`, and `parameterOf` reads the letter as a
 *  parameter name. A parameter name is a word, so a name of one letter is a drive. */
export function pathSpecifier(entry: ParsedEntry, tools: readonly string[]): string | null {
  const { tool, specifier } = entry.rule
  if (specifier === null || !tools.includes(tool)) {
    return null
  }
  const parameter = parameterOf(entry)
  return parameter !== null && parameter.length > 1 ? null : specifier
}

/** True when `pattern` starts at an anchor that a `!` pattern cannot reach: `/path` (the
 *  settings source), `~/path` (the home directory) or `//path` (the file system root). The fourth
 *  type, `path` or `./path`, is relative to the current directory. */
export function isAnchored(pattern: string): boolean {
  return pattern.startsWith('/') || pattern.startsWith('~/')
}

/** What is wrong with a path that is not in POSIX form, or null. Claude Code normalizes a
 *  Windows path before it matches, so `C:\Users\alice` is `/c/Users/alice`. */
export function windowsFault(pattern: string): 'driveLetter' | 'backslash' | null {
  if (/^[A-Za-z]:[\\/]/.test(pattern)) {
    return 'driveLetter'
  }
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '\\') {
      // A backslash before a letter, a digit, an underscore or a dot escapes a character that
      // needs no escape. A person writes it as a Windows separator. Any other character is an
      // escape of a pattern (`\[`, `\*`, `\(`), or the second half of an escaped backslash.
      if (/^\\(?:[A-Za-z0-9_.]|$)/.test(pattern.slice(i))) {
        return 'backslash'
      }
      i++
    }
  }
  return null
}

/** True when `pattern` has a `[` with no `]` to close it. A `]` right after `[`, `[!` or `[^`
 *  is a member of the class. A backslash escapes the next character. */
export function hasUnclosedBracket(pattern: string): boolean {
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '\\') {
      i++
    } else if (pattern[i] === '[') {
      let start = i + 1
      if (pattern[start] === '!' || pattern[start] === '^') {
        start++
      }
      if (pattern[start] === ']') {
        start++
      }
      const close = pattern.indexOf(']', start)
      if (close === -1) {
        return true
      }
      i = close
    }
  }
  return false
}

/** The directory name of a pattern such as `src/**`: one segment with no wildcard, then `/**`.
 *  The result is null for any other pattern. In an `allow` rule, a pattern of this shape matches
 *  one directory under the current directory. In a `deny` or `ask` rule, it matches the name at
 *  any depth (https://code.claude.com/docs/en/permissions#read-and-edit). The `./` form, `~`,
 *  `.` and `..` are not a plain name, so the result is null for them. A `:` is a drive letter,
 *  so the result is null for it. */
export function singleSegmentDirectory(pattern: string): string | null {
  const name = /^([^/]+)\/\*\*$/.exec(pattern.trim())?.[1]
  return name === undefined || /[*?[\]\\!:]/.test(name) || ['.', '..', '~'].includes(name)
    ? null
    : name
}
