// The files around a skill or command file, for a rule that reads a second
// file. A scope is a `.claude/` directory or a plugin root.
import { type Dirent, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { parseFrontmatter } from './frontmatter.ts'
import type { SkillFile } from './skill-files.ts'

/** The `.claude/` directory or the plugin root that holds `file`. */
export function scopeRoot(file: string, info: SkillFile): string {
  // A command file sits `names.length` levels below its root. A skill sits
  // in `skills/<folder>/`, and a plugin-root skill sits in the root.
  const levels = info.kind === 'command' ? info.names.length : info.names.length * 2
  let dir = path.dirname(path.resolve(file))
  for (let i = 0; i < levels; i++) {
    dir = path.dirname(dir)
  }
  return dir
}

const BLOCK = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

/** The frontmatter fields of the text of a Markdown file, or null when the
 *  file has no block on line 1, or the YAML does not parse. */
function frontmatterOf(text: string): Record<string, unknown> | null {
  const block = BLOCK.exec(text.replace(/^\u{FEFF}/u, ''))
  return block === null ? null : parseFrontmatter(block[1] as string)
}

/** The path of each `.md` file below `dir`, at any depth. The result is
 *  empty when `dir` does not exist. */
export function markdownFiles(dir: string): string[] {
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
    .flatMap((entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        return markdownFiles(full)
      }
      return entry.name.endsWith('.md') ? [full] : []
    })
}

/** The frontmatter fields of the file at `file`, or null. */
export function frontmatterOfFile(file: string): Record<string, unknown> | null {
  let text: string
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    return null
  }
  return frontmatterOf(text)
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
