// The `@path` imports of an instruction file, for each rule that reads them
// (https://code.claude.com/docs/en/memory#import-additional-files). The module
// has three parts. These are the parser, the lookup of a target in the
// bound, and the walk along the chain of imports. A rule reads no file out of the
// repository. It makes no report that rests on a file that it cannot read
// (ADR 001, Decision 14).
//
// The docs say that the parser skips code spans and fenced code blocks.
// They do not define a token any further. The parser uses these limits:
// - An `@` starts an import at the start of the text, or after white space.
//   An email address is not an import.
// - The path ends at the first white space. A backslash before a space keeps
//   the space in the path.
// - A path that starts with a quote is not an import.
// - Only a fence of backticks or tildes counts as a fenced block. An indented
//   block is not skipped, because the docs do not name it.
// - The text of an HTML comment is not an import. Claude Code strips a block
//   comment before it injects the file.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { danglingOf, isInside, realOf, UNREADABLE, type Unreadable } from './skill-tree.ts'

/** One `@path` import in the text of a file. */
export interface MemoryImport {
  /** The path as the docs read it: each `\ ` is a space. */
  path: string
  /** The offset of the `@`. */
  index: number
  /** The length of the token in the text, with the `@`. */
  length: number
}

// Stands for a character that is not part of an import. It is not white space,
// so a masked span does not make the next `@` start an import.
const MASK = '\uE000'

const blank = (text: string) => text.replace(/[^\r\n]/g, MASK)

// The line that opens or closes a fence. The prefix allows a quote mark and a list marker.
const FENCE = /^[ \t>]*(?:(?:[-*+]|\d{1,9}[.)])[ \t]+)?(`{3,}|~{3,})([^\n]*)$/

/** `text` with the lines of each fenced code block replaced by `MASK`. A fence
 *  that is never closed runs to the end of the text. */
function maskFences(text: string): string {
  let open: { char: string; size: number } | null = null
  return text
    .split('\n')
    .map((line) => {
      const match = FENCE.exec(line)
      const marks = match?.[1] as string
      const info = match?.[2] as string
      if (open === null) {
        // The info string of a backtick fence holds no backtick. Otherwise the line is a code span.
        if (match === null || (marks.startsWith('`') && info.includes('`'))) {
          return line
        }
        open = { char: marks.charAt(0), size: marks.length }
        return blank(line)
      }
      if (
        match !== null &&
        marks.startsWith(open.char) &&
        marks.length >= open.size &&
        !info.trim()
      ) {
        open = null
      }
      return blank(line)
    })
    .join('\n')
}

/** `text` with each HTML comment replaced by `MASK`. */
function maskComments(text: string): string {
  return text.replace(/<!--[\s\S]*?(?:-->|$)/g, blank)
}

const BLANK_LINE = /\n[ \t]*\r?\n/g
const RUN = /`+/g

/** The offset of the backtick run of exactly `size` backticks that closes a
 *  code span, from `from`, or -1. A span does not cross a blank line. */
function spanEnd(text: string, from: number, size: number): number {
  BLANK_LINE.lastIndex = from
  const limit = BLANK_LINE.exec(text)?.index ?? text.length
  RUN.lastIndex = from
  for (let run = RUN.exec(text); run !== null && run.index < limit; run = RUN.exec(text)) {
    if (run[0].length === size) {
      return run.index
    }
  }
  return -1
}

const SPECIAL = /[\\`]/g

/** `text` with each code span replaced by `MASK`. A backslash before a
 *  backtick makes the backtick text. */
function maskSpans(text: string): string {
  let result = ''
  let at = 0
  while (at < text.length) {
    SPECIAL.lastIndex = at
    const hit = SPECIAL.exec(text)
    if (hit === null) {
      return result + text.slice(at)
    }
    result += text.slice(at, hit.index)
    at = hit.index
    if (text.charAt(at) === '\\') {
      result += text.slice(at, at + 2)
      at += 2
      continue
    }
    let size = 1
    while (text.charAt(at + size) === '`') {
      size++
    }
    const end = spanEnd(text, at + size, size)
    const stop = end === -1 ? at + size : end + size
    result += end === -1 ? text.slice(at, stop) : blank(text.slice(at, stop))
    at = stop
  }
  return result
}

const TOKEN = /(?<=^|\s)@((?:[^\s\\\uE000`]|\\ )+)/g

/** The imports in `text`, in order. */
export function parseImports(text: string): MemoryImport[] {
  const imports: MemoryImport[] = []
  // Without an `@` there is no import. The masks cost much on a large text.
  if (!text.includes('@')) {
    return imports
  }
  for (const match of maskSpans(maskComments(maskFences(text))).matchAll(TOKEN)) {
    const written = match[1] as string
    // A path in quotes is not imported at all.
    if (!/^["']/.test(written)) {
      imports.push({
        path: written.replaceAll('\\ ', ' '),
        index: match.index,
        length: match[0].length,
      })
    }
  }
  return imports
}

// A URL, `mailto:` and the like. A drive letter has the same form.
const SCHEME = /^[a-z][a-z0-9+.-]*:/i

/** The paths to try for `imported`, or none when the rule does not check it.
 *  The docs do not say how Claude Code treats an end mark or a `#` part.
 *  So a path is there when any of its forms is there. A path that
 *  starts with `~` is in the home directory, out of the repository. */
export function candidates(imported: MemoryImport): string[] {
  if (imported.path.startsWith('~') || SCHEME.test(imported.path)) {
    return []
  }
  const withoutFragment = imported.path.replace(/#.*$/, '')
  const forms = [imported.path, withoutFragment]
  for (const form of [...forms]) {
    forms.push(form.replace(/[.,;:!?)\]}>*_"'`]+$/, ''))
  }
  return [...new Set(forms.filter((form) => form !== ''))]
}

/** Where a path is: its real path inside `bound`, `'missing'`, or
 *  `UNREADABLE`. */
export type Located = { real: string } | 'missing' | Unreadable

/** The result for a path where `realOf` gives null. The helper walks up to the
 *  nearest part that exists. The result is `UNREADABLE` in three cases. The
 *  helper meets a dangling link. It meets a part that it cannot read. The
 *  real path is out of `bound`. Otherwise the path is missing. */
function missingOf(file: string, bound: string): 'missing' | Unreadable {
  const rest: string[] = []
  let at = path.resolve(file)
  let real = realOf(at)
  while (real === null) {
    if (danglingOf(at) !== null || path.dirname(at) === at) {
      return UNREADABLE
    }
    rest.unshift(path.basename(at))
    at = path.dirname(at)
    real = realOf(at)
  }
  return typeof real === 'string' && isInside(path.join(real, ...rest), bound)
    ? 'missing'
    : UNREADABLE
}

/** Find `file`. A real path out of `bound` is `UNREADABLE`. So is a dangling
 *  link, and so is a path that the rule cannot read. */
export function locate(file: string, bound: string): Located {
  const real = realOf(file)
  if (typeof real === 'string') {
    return isInside(real, bound) ? { real } : UNREADABLE
  }
  return real === null ? missingOf(file, bound) : real
}

/** The text of the file at the real path `real`. The result is null for a
 *  directory, and `UNREADABLE` when the read fails. */
export function readImported(real: string): string | null | Unreadable {
  try {
    return readFileSync(real, 'utf8')
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EISDIR' ? null : UNREADABLE
  }
}

/** The first of `forms`, resolved in `dir`, that is a file or directory in
 *  `bound`. The result is `'missing'` when none is there and all could be
 *  read. It is `UNREADABLE` when none is there and some could not be read. */
export function findImport(dir: string, forms: string[], bound: string): Located {
  let result: Located = 'missing'
  for (const form of forms) {
    const found = locate(path.resolve(dir, form), bound)
    if (typeof found === 'object') {
      return found
    }
    if (found === UNREADABLE) {
      result = UNREADABLE
    }
  }
  return result
}

/** The files that a chain of imports loads. */
export interface Chain {
  /** The real path of each file that Claude Code loads, with its hops from the root. The root is at 0. */
  loaded: Map<string, number>
  /** The real path of the file past the limit, for each import of the root that leads to one. The key is the index of the import. */
  tooDeep: Map<number, string>
  /** True when the chain holds a path that the rule cannot read: a file or link that fails, or an import out of the repository. */
  unreadable: boolean
}

interface Step {
  file: string
  text: string
  hops: number
  /** The index of the import of the root that this step comes from. */
  top: number
}

/** Follow the imports of the root file `file`, whose text is `text`, down to
 *  `limit` hops. A file is loaded at its fewest hops, and once. So a cycle ends
 *  where it meets a file that the chain has met. A file past the limit is
 *  not loaded, and is not read further. */
export function followImports(file: string, text: string, bound: string, limit: number): Chain {
  const rootReal = realOf(file)
  const rootKey = typeof rootReal === 'string' ? rootReal : path.resolve(file)
  const chain: Chain = { loaded: new Map([[rootKey, 0]]), tooDeep: new Map(), unreadable: false }
  const seen = new Set([rootKey])
  const queue: Step[] = [{ file: path.resolve(file), text, hops: 0, top: -1 }]
  for (const step of queue) {
    for (const [index, imported] of parseImports(step.text).entries()) {
      const forms = candidates(imported)
      // A path out of the repository can lead back into it. The rule cannot read it.
      const found =
        forms.length === 0 ? UNREADABLE : findImport(path.dirname(step.file), forms, bound)
      if (found === UNREADABLE) {
        chain.unreadable = true
      }
      if (typeof found !== 'object' || seen.has(found.real)) {
        continue
      }
      seen.add(found.real)
      const loadedText = readImported(found.real)
      if (typeof loadedText !== 'string') {
        // A directory loads nothing. A file that fails to read can hold any import.
        chain.unreadable ||= loadedText === UNREADABLE
        continue
      }
      const top = step.hops === 0 ? index : step.top
      if (step.hops + 1 > limit) {
        if (!chain.tooDeep.has(top)) {
          chain.tooDeep.set(top, found.real)
        }
        continue
      }
      chain.loaded.set(found.real, step.hops + 1)
      queue.push({ file: found.real, text: loadedText, hops: step.hops + 1, top })
    }
  }
  return chain
}
