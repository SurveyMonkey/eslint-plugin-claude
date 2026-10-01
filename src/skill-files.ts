// Find out if a file is a skill or a command file. The globs of the rules are
// broad, so each rule asks here where the file sits (ADR 001, Decision 10).
// A plugin root is found by its manifest.
import path from 'node:path'
import { isPluginRoot } from './plugin-root.ts'

export interface SkillFile {
  kind: 'skill' | 'command'
  /** True when the file is in a plugin. */
  plugin: boolean
  /** The names that make the command name: the skill folder, or each folder
   *  and the file name below `commands/`. A plugin-root `SKILL.md` has none. */
  names: string[]
}

/** The directory of the first `count` path parts. */
function dirOf(parts: string[], count: number): string {
  return parts.slice(0, count).join(path.sep) || path.sep
}

/** What `file` is: a skill (`.claude/skills/<name>/SKILL.md`,
 *  `<plugin>/skills/<name>/SKILL.md`, `<plugin>/SKILL.md`), a command file
 *  (`.claude/commands/**`, `<plugin>/commands/**`), or null. */
export function classifySkillFile(file: string): SkillFile | null {
  const parts = path.resolve(file).split(path.sep)
  const last = parts.length - 1
  const base = parts[last] as string
  if (base === 'SKILL.md') {
    const folder = parts[last - 1] as string
    if (isPluginRoot(dirOf(parts, last))) {
      return { kind: 'skill', plugin: true, names: [] }
    }
    if (parts[last - 2] === 'skills') {
      if (parts[last - 3] === '.claude') {
        return { kind: 'skill', plugin: false, names: [folder] }
      }
      if (isPluginRoot(dirOf(parts, last - 2))) {
        return { kind: 'skill', plugin: true, names: [folder] }
      }
    }
  }
  // The deepest `commands/` directory that fits is the one that counts.
  for (let i = last - 1; i >= 1; i--) {
    if (parts[i] !== 'commands') {
      continue
    }
    const inClaude = parts[i - 1] === '.claude'
    if (inClaude || isPluginRoot(dirOf(parts, i))) {
      const stem = base.replace(/\.md$/, '')
      return { kind: 'command', plugin: !inClaude, names: [...parts.slice(i + 1, last), stem] }
    }
  }
  return null
}
