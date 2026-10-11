// What an instruction file is, from its path. The docs name the places:
// https://code.claude.com/docs/en/memory#choose-where-to-put-claude-md-files
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { classifyMemoryFile } from '../src/memory-files.ts'

const at = (...parts: string[]) => classifyMemoryFile(path.join('/repo', ...parts))

describe('classifyMemoryFile', () => {
  it('reads a CLAUDE.md in the root, in a subdirectory and in .claude', () => {
    expect(at('CLAUDE.md')).toBe('claude-md')
    expect(at('packages', 'web', 'CLAUDE.md')).toBe('claude-md')
    expect(at('.claude', 'CLAUDE.md')).toBe('claude-md')
  })

  it('reads a CLAUDE.local.md', () => {
    expect(at('CLAUDE.local.md')).toBe('claude-local')
    expect(at('packages', 'web', 'CLAUDE.local.md')).toBe('claude-local')
  })

  it('reads a file below .claude/rules, at any depth, as a rule', () => {
    expect(at('.claude', 'rules', 'testing.md')).toBe('rule')
    expect(at('.claude', 'rules', 'frontend', 'react.md')).toBe('rule')
    expect(at('packages', 'web', '.claude', 'rules', 'a.md')).toBe('rule')
    expect(at('.claude', 'rules', 'notes.txt')).toBe('rule')
  })

  it('reads an AGENTS variant name below .claude/rules as a rule', () => {
    expect(at('.claude', 'rules', 'AGENTS.override.md')).toBe('rule')
    expect(at('.claude', 'rules', 'AGENTS.local.md')).toBe('rule')
    expect(at('.claude', 'rules', '.agents', 'x.md')).toBe('rule')
  })

  it('reads a CLAUDE.md in .claude/rules as a rule, not as a CLAUDE.md', () => {
    expect(at('.claude', 'rules', 'CLAUDE.md')).toBe('rule')
    expect(at('.claude', 'rules', 'CLAUDE.local.md')).toBe('rule')
  })

  it('reads the AGENTS.md files that Claude Code never reads', () => {
    expect(at('AGENTS.local.md')).toBe('agents-variant')
    expect(at('packages', 'web', 'AGENTS.override.md')).toBe('agents-variant')
    expect(at('.agents', 'skills', 'x', 'SKILL.md')).toBe('agents-variant')
    expect(at('packages', 'web', '.agents', 'notes.md')).toBe('agents-variant')
  })

  it('gives null for a file that Claude Code does not read as instructions', () => {
    expect(at('AGENTS.md')).toBeNull()
    expect(at('.agents', 'config.json')).toBeNull()
    expect(at('docs', 'CLAUDE-notes.md')).toBeNull()
    expect(at('claude.md')).toBeNull()
    expect(at('rules', 'a.md')).toBeNull()
    expect(at('.claude', 'agents', 'a.md')).toBeNull()
    expect(at('.claude', 'skills', 'rules', 'a.md')).toBeNull()
    expect(at('.claude', 'rules')).toBeNull()
  })
})
