// The files around a skill or command file, for a rule that reads a second
// file. A scope is a `.claude/` directory or a plugin root. A rule reads no
// file out of the repository that holds the scope.
import { type Dirent, existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import path from 'node:path'
import { parseFrontmatter } from './frontmatter.ts'
import type { SkillFile } from './skill-files.ts'

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

/** The real path of `dir`, or its absolute path when it does not exist. */
export function realDirectory(dir: string): string {
  return realOf(dir) ?? path.resolve(dir)
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

/** The real path of `file`, or null when it does not exist (a dangling link). */
function realOf(file: string): string | null {
  try {
    return realpathSync(file)
  } catch {
    return null
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
 *  a link because its target is out of the bound. */
export interface Scan {
  files: string[]
  outside: boolean
}

/** The path of each `.md` file below `dir`, at any depth, with a real path at
 *  or below `bound`. A link to a directory is followed once, and the real
 *  directory comes before a link to it. The walk skips `.git` and
 *  `node_modules`. A link to a file counts when the file exists. The result
 *  is empty when `dir` does not exist. */
export function markdownFiles(dir: string, bound: string): Scan {
  const scan: Scan = { files: [], outside: false }
  walk(dir, bound, new Set<string>(), scan)
  return scan
}

function walk(dir: string, bound: string, seen: Set<string>, scan: Scan): void {
  const real = realOf(dir)
  if (real === null || seen.has(real)) {
    return
  }
  if (!isInside(real, bound)) {
    scan.outside = true
    return
  }
  seen.add(real)
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
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
      if (target === null) {
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
 *  `bound`. The result is empty when `dir` does not exist. */
export function skillFiles(dir: string, bound: string): string[] {
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
    .map((entry) => path.join(dir, entry.name, 'SKILL.md'))
    .filter((file) => {
      const real = realOf(file)
      return real !== null && isInside(real, bound)
    })
}

// The fields of each file that was read, by path. An entry is current while
// the time of the last write and the size of the file are the same.
const read = new Map<string, { stamp: string; fields: Record<string, unknown> | null }>()

/** The frontmatter fields of the file at `file`, or null. */
export function frontmatterOfFile(file: string): Record<string, unknown> | null {
  try {
    const stat = statSync(file, { bigint: true })
    const stamp = `${stat.mtimeNs}:${stat.size}`
    const hit = read.get(file)
    if (hit?.stamp === stamp) {
      return hit.fields
    }
    const fields = frontmatterOf(readFileSync(file, 'utf8'))
    read.set(file, { stamp, fields })
    return fields
  } catch {
    return null
  }
}

/** The fields of `.claude-plugin/plugin.json` in the plugin root `root`, or
 *  null when the file does not parse to an object, or its real path is out of
 *  `bound`. */
export function readManifest(root: string, bound: string): Record<string, unknown> | null {
  const file = path.join(root, '.claude-plugin', 'plugin.json')
  const real = realOf(file)
  if (real === null || !isInside(real, bound)) {
    return null
  }
  try {
    const data: unknown = JSON.parse(readFileSync(real, 'utf8'))
    return data !== null && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}
