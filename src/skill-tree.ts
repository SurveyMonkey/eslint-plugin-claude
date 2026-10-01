// The files around a skill or command file, for a rule that reads a second
// file. A scope is a `.claude/` directory or a plugin root.
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

const BLOCK = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

/** The frontmatter fields of the text of a Markdown file. The result is null
 *  when line 1 starts no block, or the YAML does not parse. */
function frontmatterOf(text: string): Record<string, unknown> | null {
  const block = BLOCK.exec(text.replace(/^\u{FEFF}/u, ''))
  return block === null ? null : parseFrontmatter(block[1] as string)
}

/** What `file` is after its links are followed: a directory, a file, or null
 *  when it does not exist (a dangling link). */
function kindOf(file: string): 'directory' | 'file' | null {
  try {
    return statSync(file).isDirectory() ? 'directory' : 'file'
  } catch {
    return null
  }
}

// Directories that hold no agent or command files, and can be very large.
const SKIPPED = new Set(['.git', 'node_modules'])

/** The path of each `.md` file below `dir`, at any depth. A link to a
 *  directory is followed once, and the real directory comes before a link to
 *  it. The walk skips `.git` and `node_modules`. A link to a file counts when
 *  the file exists. The result is empty when `dir` does not exist. */
export function markdownFiles(dir: string, seen = new Set<string>()): string[] {
  let entries: Dirent[]
  try {
    const real = realpathSync(dir)
    if (seen.has(real)) {
      return []
    }
    seen.add(real)
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((entry) => !SKIPPED.has(entry.name))
    .sort(
      (a, b) =>
        Number(a.isSymbolicLink()) - Number(b.isSymbolicLink()) ||
        a.name.localeCompare(b.name, 'en'),
    )
    .flatMap((entry) => {
      const full = path.join(dir, entry.name)
      const kind = entry.isSymbolicLink()
        ? kindOf(full)
        : entry.isDirectory()
          ? 'directory'
          : 'file'
      if (kind === 'directory') {
        return markdownFiles(full, seen)
      }
      return kind === 'file' && entry.name.endsWith('.md') ? [full] : []
    })
}

/** The `SKILL.md` of each folder directly in `dir`, which is a `skills/`
 *  directory. A link to a folder counts. The result is empty when `dir` does
 *  not exist. */
export function skillFiles(dir: string): string[] {
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
    .map((entry) => path.join(dir, entry.name, 'SKILL.md'))
    .filter((file) => existsSync(file))
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
 *  null when the file does not parse to an object. */
export function readManifest(root: string): Record<string, unknown> | null {
  try {
    const data: unknown = JSON.parse(
      readFileSync(path.join(root, '.claude-plugin', 'plugin.json'), 'utf8'),
    )
    return data !== null && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}
