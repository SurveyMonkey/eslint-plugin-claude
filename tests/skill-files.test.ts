// The layouts of ADR 001 Decision 10: where a skill or command file sits
// decides what it is. A plugin root is found by its manifest, on disk.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { classifySkillFile } from '../src/skill-files.ts'
import { chmodCannotBlock, withoutAccess } from './rule-tester.test-support.ts'

const scratch = mkdtempSync(path.join(tmpdir(), 'skill-files-'))
const plugin = path.join(scratch, 'plugins', 'p')
mkdirSync(path.join(plugin, '.claude-plugin'), { recursive: true })
writeFileSync(path.join(plugin, '.claude-plugin', 'plugin.json'), '{}')

afterAll(() => rmSync(scratch, { recursive: true, force: true }))

const at = (...parts: string[]) => classifySkillFile(path.join(scratch, ...parts))

describe('classifySkillFile', () => {
  it('reads a project skill', () => {
    expect(at('.claude', 'skills', 'deploy', 'SKILL.md')).toEqual({
      kind: 'skill',
      plugin: false,
      names: ['deploy'],
    })
  })

  it('reads a plugin skill and a plugin-root skill', () => {
    expect(classifySkillFile(path.join(plugin, 'skills', 'review', 'SKILL.md'))).toEqual({
      kind: 'skill',
      plugin: true,
      names: ['review'],
    })
    expect(classifySkillFile(path.join(plugin, 'SKILL.md'))).toEqual({
      kind: 'skill',
      plugin: true,
      names: [],
    })
  })

  it('reads a skill folder that holds a manifest as a plugin', () => {
    const folder = path.join(scratch, '.claude', 'skills', 'own')
    mkdirSync(path.join(folder, '.claude-plugin'), { recursive: true })
    writeFileSync(path.join(folder, '.claude-plugin', 'plugin.json'), '{}')
    expect(classifySkillFile(path.join(folder, 'SKILL.md'))?.plugin).toBe(true)
  })

  it('reads a command file with the names below commands/', () => {
    expect(at('.claude', 'commands', 'ops', 'deploy.md')).toEqual({
      kind: 'command',
      plugin: false,
      names: ['ops', 'deploy'],
    })
    expect(classifySkillFile(path.join(plugin, 'commands', 'run.md'))).toEqual({
      kind: 'command',
      plugin: true,
      names: ['run'],
    })
  })

  it('reads a SKILL.md in commands/ as a command file', () => {
    expect(at('.claude', 'commands', 'SKILL.md')).toEqual({
      kind: 'command',
      plugin: false,
      names: ['SKILL'],
    })
  })

  it('uses the deepest commands/ directory that fits', () => {
    expect(at('commands', 'x', '.claude', 'commands', 'a.md')?.names).toEqual(['a'])
    // Both directories fit: the inner one gives the names.
    expect(at('.claude', 'commands', 'x', '.claude', 'commands', 'a.md')?.names).toEqual(['a'])
  })

  it('gives null for a file in no skill or command location', () => {
    expect(at('docs', 'SKILL.md')).toBeNull()
    expect(at('skills', 's', 'SKILL.md')).toBeNull()
    expect(at('.claude', 'skills', 'SKILL.md')).toBeNull()
    expect(at('.claude', 'skills', 'a', 'b', 'SKILL.md')).toBeNull()
    expect(at('docs', 'commands', 'a.md')).toBeNull()
    expect(at('commands.md')).toBeNull()
    // Only a file named SKILL.md is a skill file.
    expect(at('.claude', 'skills', 'a', 'other.md')).toBeNull()
    expect(classifySkillFile(path.join(plugin, 'skills', 'a', 'other.md'))).toBeNull()
    expect(classifySkillFile(path.join(plugin, 'README.md'))).toBeNull()
    // A `.claude` folder in a plugin does not make a skill without `skills/`.
    expect(classifySkillFile(path.join(plugin, '.claude', 'a', 'SKILL.md'))).toBeNull()
    expect(classifySkillFile(`${path.sep}commands${path.sep}a.md`)).toBeNull()
  })
})

// A plugin root that the check cannot see gives no classification. The file is
// not a plugin file, and it is not a local file either.
describe('classifySkillFile for a plugin root that it cannot see', () => {
  const unseen = (plugin: string) => {
    mkdirSync(path.join(scratch, 'unseen', plugin, '.claude-plugin'), { recursive: true })
    writeFileSync(path.join(scratch, 'unseen', plugin, '.claude-plugin', 'plugin.json'), '{}')
    return path.join(scratch, 'unseen', plugin, '.claude-plugin')
  }
  const file = (...parts: string[]) => path.join(scratch, 'unseen', ...parts)

  describe.skipIf(chmodCannotBlock)('with no access to .claude-plugin/', () => {
    it('gives null for a plugin-root skill and a plugin skill', () => {
      withoutAccess(unseen('p'), () => {
        expect(classifySkillFile(file('p', 'SKILL.md'))).toBeNull()
        expect(classifySkillFile(file('p', 'skills', 's', 'SKILL.md'))).toBeNull()
      })
    })

    it('gives null for a plugin command file', () => {
      withoutAccess(unseen('p'), () => {
        expect(classifySkillFile(file('p', 'commands', 'c.md'))).toBeNull()
      })
    })

    it.fails('gives null for a plugin root in `.claude/skills/`, and not a project skill', () => {
      withoutAccess(unseen('.claude/skills/own'), () => {
        expect(classifySkillFile(file('.claude', 'skills', 'own', 'SKILL.md'))).toBeNull()
      })
    })

    it.fails('stops at an unseen plugin root, and does not use a `commands/` directory above it', () => {
      withoutAccess(unseen('.claude/commands/plug'), () => {
        expect(
          classifySkillFile(file('.claude', 'commands', 'plug', 'commands', 'a.md')),
        ).toBeNull()
      })
    })
  })

  describe.skipIf(process.platform === 'win32')(
    'with `.claude-plugin/` linked out of the repository',
    () => {
      it.fails('gives null', () => {
        mkdirSync(path.join(scratch, 'repo', '.git'), { recursive: true })
        mkdirSync(path.join(scratch, 'elsewhere', 'meta'), { recursive: true })
        writeFileSync(path.join(scratch, 'elsewhere', 'meta', 'plugin.json'), '{}')
        mkdirSync(path.join(scratch, 'repo', 'p'))
        symlinkSync(
          path.join(scratch, 'elsewhere', 'meta'),
          path.join(scratch, 'repo', 'p', '.claude-plugin'),
        )
        expect(
          classifySkillFile(path.join(scratch, 'repo', 'p', 'skills', 's', 'SKILL.md')),
        ).toBeNull()
      })
    },
  )

  it.fails('still gives a plugin for a dangling manifest link', () => {
    mkdirSync(path.join(scratch, 'dangling', '.claude-plugin'), { recursive: true })
    symlinkSync('missing.json', path.join(scratch, 'dangling', '.claude-plugin', 'plugin.json'))
    expect(
      classifySkillFile(path.join(scratch, 'dangling', 'skills', 's', 'SKILL.md'))?.plugin,
    ).toBe(true)
  })
})
