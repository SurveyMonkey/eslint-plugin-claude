// Find out if a file is a skill or a command file. The globs of the rules are
// broad, so each rule asks here where the file sits (ADR 001, Decision 10).
// A plugin root is found by its manifest. A root that the check cannot see gives null.
import path from 'node:path'
import { isPluginRoot } from './plugin-root.ts'
import { UNREADABLE } from './skill-tree.ts'

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
 *  (`.claude/commands/**`, `<plugin>/commands/**`), or null. The result is also
 *  null when the plugin root of the file is unseen. */
export function classifySkillFile(file: string): SkillFile | null {
  const parts = path.resolve(file).split(path.sep)
  const last = parts.length - 1
  const base = parts[last] as string
  if (base === 'SKILL.md') {
    const folder = parts[last - 1] as string
    const here = isPluginRoot(dirOf(parts, last))
    // A root that the check cannot see is not a plugin to judge, and not a local scope.
    if (here === UNREADABLE) {
      return null
    }
    if (here) {
      return { kind: 'skill', plugin: true, names: [] }
    }
    if (parts[last - 2] === 'skills') {
      if (parts[last - 3] === '.claude') {
        return { kind: 'skill', plugin: false, names: [folder] }
      }
      const root = isPluginRoot(dirOf(parts, last - 2))
      if (root === UNREADABLE) {
        return null
      }
      if (root) {
        return { kind: 'skill', plugin: true, names: [folder] }
      }
    }
  }
  // The deepest `commands/` directory that fits is the one that counts, unless
  // its plugin root is unseen.
  for (let i = last - 1; i >= 1; i--) {
    if (parts[i] !== 'commands') {
      continue
    }
    const inClaude = parts[i - 1] === '.claude'
    const root = inClaude ? false : isPluginRoot(dirOf(parts, i))
    // The walk stops at a root that the check cannot see. It does not go on to a
    // `commands/` directory above it.
    if (root === UNREADABLE) {
      return null
    }
    if (inClaude || root) {
      const stem = base.replace(/\.md$/, '')
      return { kind: 'command', plugin: !inClaude, names: [...parts.slice(i + 1, last), stem] }
    }
  }
  return null
}
