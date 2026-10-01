// The files around a skill or command file, for a rule that reads a second
// file. A scope is a `.claude/` directory or a plugin root. A rule reads no
// file out of the repository that holds the scope.
//
// A read in this file has three results: the content, absent (`ENOENT` or
// `ENOTDIR`), and unreadable (any other error code, such as `EACCES`). A
// failed read is not the same as a file that is not there. A rule makes no
// report that rests on a file that it cannot see. The `.git` test in
// `repositoryRoot` still uses `existsSync`.
import {
  type BigIntStats,
  type Dirent,
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  type Stats,
  statSync,
} from 'node:fs'
import path from 'node:path'
import { parseFrontmatter } from './frontmatter.ts'
import type { SkillFile } from './skill-files.ts'

/** The result of a read that failed, and was not a missing file. */
export const UNREADABLE: unique symbol = Symbol('unreadable')
export type Unreadable = typeof UNREADABLE

/** The result of a failed read: null for a file that is not there, and
 *  `UNREADABLE` for any other error. */
function failure(error: unknown): null | Unreadable {
  const code = (error as NodeJS.ErrnoException).code
  return code === 'ENOENT' || code === 'ENOTDIR' ? null : UNREADABLE
}

/** The stat of `file`, null when it is not there, or `UNREADABLE`. Test for
 *  absence with `=== null`, never with a truthiness test. */
export function statOf(file: string): Stats | null | Unreadable {
  try {
    return statSync(file)
  } catch (error) {
    return failure(error)
  }
}

/** The text of `file`, null when it is not there, or `UNREADABLE`. */
function textOf(file: string): string | null | Unreadable {
  try {
    return readFileSync(file, 'utf8')
  } catch (error) {
    return failure(error)
  }
}

/** The `.claude/` directory or the plugin root that holds `file`. */
export function scopeRoot(file: string, info: SkillFile): string {
  // The directory of a command file sits `names.length` levels below its root. A skill sits
  // in `skills/<folder>/`, and a plugin-root skill sits in the root.
  const levels = info.kind === 'command' ? info.names.length : info.names.length * 2
  let dir = path.dirname(path.resolve(file))
  for (let i = 0; i < levels; i++) {
    dir = path.dirname(dir)
  }
  return dir
}

/** The real path of `dir`, or its absolute path when it does not exist or
 *  the rule cannot read it. */
export function realDirectory(dir: string): string {
  const real = realOf(dir)
  return typeof real === 'string' ? real : path.resolve(dir)
}

/** The real path of the repository that holds `dir`: the first directory at
 *  or above `dir` that holds `.git`. Without one, the real path of `dir`. */
export function repositoryRoot(dir: string): string {
  const start = realDirectory(dir)
  for (let at = start; ; at = path.dirname(at)) {
    if (existsSync(path.join(at, '.git'))) {
      return at
    }
    if (path.dirname(at) === at) {
      return start
    }
  }
}

/** True when the real path `real` is `bound` or below it. */
function isInside(real: string, bound: string): boolean {
  // `path.resolve` drops a trailing separator, except on the root of the file system.
  const base = path.resolve(bound)
  return real === base || real.startsWith(base.endsWith(path.sep) ? base : base + path.sep)
}

/** The real path of `file`, null when it does not exist (a dangling link), or
 *  `UNREADABLE`. */
function realOf(file: string): string | null | Unreadable {
  try {
    return realpathSync(file)
  } catch (error) {
    return failure(error)
  }
}

/** The entries of the directory `dir`, null when it is not there, or
 *  `UNREADABLE`. */
function entriesOf(dir: string): Dirent[] | null | Unreadable {
  try {
    return readdirSync(dir, { withFileTypes: true })
  } catch (error) {
    return failure(error)
  }
}

const BLOCK = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

/** The frontmatter fields of the text of a Markdown file. The result is null
 *  when line 1 starts no block, or the YAML does not parse. */
function frontmatterOf(text: string): Record<string, unknown> | null {
  const block = BLOCK.exec(text.replace(/^\u{FEFF}/u, ''))
  return block === null ? null : parseFrontmatter(block[1] as string)
}

// Directories that hold no agent or command files, and can be very large.
const SKIPPED = new Set(['.git', 'node_modules'])

/** The `.md` files of a scan. `outside` is true when the scan did not follow
 *  a link because its target is out of the bound. `unreadable` is true when
 *  the scan could not read a directory or a link. */
export interface Scan {
  files: string[]
  outside: boolean
  unreadable: boolean
}

/** The path of each `.md` file below `dir`, at any depth, with a real path at
 *  or below `bound`. A link to a directory is followed once, and the real
 *  directory comes before a link to it. The walk skips `.git` and
 *  `node_modules`. A link to a file counts when the file exists. The result
 *  is empty when `dir` does not exist. When the scan cannot read a directory,
 *  it sets `unreadable` and keeps the files that it found. */
export function markdownFiles(dir: string, bound: string): Scan {
  const scan: Scan = { files: [], outside: false, unreadable: false }
  walk(dir, bound, new Set<string>(), scan)
  return scan
}

function walk(dir: string, bound: string, seen: Set<string>, scan: Scan): void {
  const real = realOf(dir)
  if (real === UNREADABLE) {
    scan.unreadable = true
    return
  }
  if (real === null || seen.has(real)) {
    return
  }
  if (!isInside(real, bound)) {
    scan.outside = true
    return
  }
  seen.add(real)
  const entries = entriesOf(dir)
  if (entries === UNREADABLE) {
    scan.unreadable = true
  }
  if (!Array.isArray(entries)) {
    return
  }
  const sorted = entries
    .filter((entry) => !SKIPPED.has(entry.name))
    .sort(
      (a, b) =>
        Number(a.isSymbolicLink()) - Number(b.isSymbolicLink()) ||
        a.name.localeCompare(b.name, 'en'),
    )
  for (const entry of sorted) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, bound, seen, scan)
    } else if (entry.isSymbolicLink()) {
      const target = realOf(full)
      if (target === UNREADABLE) {
        scan.unreadable = true
      }
      if (typeof target !== 'string') {
        continue
      }
      if (!isInside(target, bound)) {
        scan.outside = true
      } else if (statSync(target).isDirectory()) {
        walk(full, bound, seen, scan)
      } else if (entry.name.endsWith('.md')) {
        scan.files.push(full)
      }
    } else if (entry.name.endsWith('.md')) {
      scan.files.push(full)
    }
  }
}

/** The `SKILL.md` of each folder directly in `dir`, which is a `skills/`
 *  directory. A link to a folder counts when its real path is at or below
 *  `bound`. The result is empty when `dir` does not exist. A folder or a
 *  directory that the scan cannot read is not listed, so that the caller
 *  compares no name that it cannot read. */
export function skillFiles(dir: string, bound: string): string[] {
  const entries = entriesOf(dir)
  if (!Array.isArray(entries)) {
    return []
  }
  return entries
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
    .map((entry) => path.join(dir, entry.name, 'SKILL.md'))
    .filter((file) => {
      const real = realOf(file)
      return typeof real === 'string' && isInside(real, bound)
    })
}

// The fields of each file that was read, by path. An entry is current while
// the time of the last write and the size of the file are the same.
const read = new Map<string, { stamp: string; fields: Record<string, unknown> | null }>()

/** The frontmatter fields of the file at `file`. The result is null when the
 *  file is not there, has no block, or has YAML that does not parse. The
 *  result is `UNREADABLE` when the read fails for another reason, and the
 *  cache keeps no entry for it. */
export function frontmatterOfFile(file: string): Record<string, unknown> | null | Unreadable {
  let stat: BigIntStats
  try {
    stat = statSync(file, { bigint: true })
  } catch (error) {
    return failure(error)
  }
  const stamp = `${stat.mtimeNs}:${stat.size}`
  const hit = read.get(file)
  if (hit?.stamp === stamp) {
    return hit.fields
  }
  const text = textOf(file)
  if (typeof text !== 'string') {
    return text
  }
  const fields = frontmatterOf(text)
  read.set(file, { stamp, fields })
  return fields
}

/** The fields of `.claude-plugin/plugin.json` in the plugin root `root`. The
 *  result is null in three cases. The file is not there, it does not parse to
 *  an object, or its real path is out of `bound`. The result is `UNREADABLE`
 *  when a read fails for another reason. */
export function readManifest(
  root: string,
  bound: string,
): Record<string, unknown> | null | Unreadable {
  const file = path.join(root, '.claude-plugin', 'plugin.json')
  const real = realOf(file)
  if (typeof real !== 'string') {
    return real
  }
  if (!isInside(real, bound)) {
    return null
  }
  const text = textOf(real)
  if (typeof text !== 'string') {
    return text
  }
  try {
    const data: unknown = JSON.parse(text)
    return data !== null && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}
