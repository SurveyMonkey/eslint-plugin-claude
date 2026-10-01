// The layouts of ADR 001 Decision 10: where a skill or command file sits
// decides what it is. A plugin root is found by its manifest, on disk.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { classifySkillFile } from '../src/skill-files.ts'

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
    expect(classifySkillFile(`${path.sep}commands${path.sep}a.md`)).toBeNull()
  })
})
