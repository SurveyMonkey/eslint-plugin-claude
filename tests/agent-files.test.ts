// Where a subagent file or an output style file sits decides what it is. A
// plugin root is found by its manifest, on disk. A root that the check cannot
// see gives null, and the walk does not go on to an `agents/` directory above it.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { classifyAgentFile, classifyOutputStyle } from '../src/agent-files.ts'
import { chmodCannotBlock, withoutAccess } from './rule-tester.test-support.ts'

const scratch = mkdtempSync(path.join(tmpdir(), 'agent-files-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
const at = (...parts: string[]) => path.join(scratch, ...parts)
const plugin = (...parts: string[]) => {
  mkdirSync(at(...parts, '.claude-plugin'), { recursive: true })
  writeFileSync(at(...parts, '.claude-plugin', 'plugin.json'), '{}')
  return at(...parts, '.claude-plugin')
}

describe('a plugin root that the check can see', () => {
  it('gives plugin for an agent file and an output style file', () => {
    plugin('p')
    expect(classifyAgentFile(at('p', 'agents', 'a.md'))).toMatchObject({ plugin: true })
    expect(classifyAgentFile(at('p', 'agents', 'deep', 'a.md'))).toMatchObject({ plugin: true })
    expect(classifyOutputStyle(at('p', 'output-styles', 's.md'))).toEqual({ plugin: true })
  })

  it('gives local for `.claude/`, and null for a directory with no manifest', () => {
    expect(classifyAgentFile(at('.claude', 'agents', 'a.md'))).toMatchObject({ plugin: false })
    expect(classifyOutputStyle(at('.claude', 'output-styles', 's.md'))).toEqual({ plugin: false })
    expect(classifyAgentFile(at('none', 'agents', 'a.md'))).toBeNull()
    expect(classifyOutputStyle(at('none', 'output-styles', 's.md'))).toBeNull()
    expect(classifyOutputStyle(at('p', 'other', 's.md'))).toBeNull()
  })

  it('gives plugin for a dangling manifest link', () => {
    mkdirSync(at('dangling', '.claude-plugin'), { recursive: true })
    symlinkSync('missing.json', at('dangling', '.claude-plugin', 'plugin.json'))
    expect(classifyAgentFile(at('dangling', 'agents', 'a.md'))).toMatchObject({ plugin: true })
  })
})

// The root is the parent of the deepest `agents/` directory that fits.
describe('the scope root of an agent file', () => {
  it('is the plugin root for a plugin agent', () => {
    plugin('r1')
    expect(classifyAgentFile(at('r1', 'agents', 'a.md'))).toEqual({ plugin: true, root: at('r1') })
  })

  it('is the `.claude/` directory for a local agent', () => {
    expect(classifyAgentFile(at('r2', '.claude', 'agents', 'a.md'))).toEqual({
      plugin: false,
      root: at('r2', '.claude'),
    })
  })

  it('is the same for a file in a subfolder of `agents/`', () => {
    plugin('r3')
    expect(classifyAgentFile(at('r3', 'agents', 'x', 'y', 'a.md'))).toMatchObject({
      root: at('r3'),
    })
    expect(classifyAgentFile(at('r3', '.claude', 'agents', 'x', 'y', 'a.md'))).toMatchObject({
      root: at('r3', '.claude'),
    })
  })

  it('skips a nested `agents/` directory that does not fit', () => {
    plugin('r4')
    // `r4/agents/agents` has no manifest beside it, so `r4/agents` is the one that fits.
    expect(classifyAgentFile(at('r4', 'agents', 'agents', 'a.md'))).toMatchObject({
      root: at('r4'),
    })
    // The same holds under `.claude/`: `r4/.claude/agents/agents` does not fit either.
    expect(classifyAgentFile(at('r4', '.claude', 'agents', 'agents', 'a.md'))).toMatchObject({
      root: at('r4', '.claude'),
    })
  })

  it('gives null when the file is no agent file', () => {
    expect(classifyAgentFile(at('r5', 'docs', 'a.md'))).toBeNull()
  })

  // The parent of a directory that is not `agents/` can be `.claude/`. That is no agent file.
  it('gives null for a file in `.claude/` outside `agents/`', () => {
    expect(classifyAgentFile(at('r6', '.claude', 'commands', 'a.md'))).toBeNull()
  })

  // Two `agents/` directories fit. The deepest one counts.
  it('gives the root of the deepest `agents/` directory that fits', () => {
    plugin('r7')
    expect(classifyAgentFile(at('r7', 'agents', 'x', '.claude', 'agents', 'a.md'))).toEqual({
      plugin: false,
      root: at('r7', 'agents', 'x', '.claude'),
    })
  })
})

describe.skipIf(chmodCannotBlock)('with no access to .claude-plugin/', () => {
  it('gives null for an agent file and an output style file', () => {
    withoutAccess(plugin('p2'), () => {
      expect(classifyAgentFile(at('p2', 'agents', 'a.md'))).toBeNull()
      expect(classifyOutputStyle(at('p2', 'output-styles', 's.md'))).toBeNull()
    })
  })

  it('stops at the unseen root, and does not use the `.claude/agents/` above it', () => {
    withoutAccess(plugin('.claude', 'agents', 'plug'), () => {
      expect(classifyAgentFile(at('.claude', 'agents', 'plug', 'agents', 'a.md'))).toBeNull()
    })
  })
})

describe.skipIf(process.platform === 'win32')(
  'with `.claude-plugin/` linked out of the repository',
  () => {
    it('gives null', () => {
      mkdirSync(at('repo', '.git'), { recursive: true })
      mkdirSync(at('elsewhere', 'meta'), { recursive: true })
      writeFileSync(at('elsewhere', 'meta', 'plugin.json'), '{}')
      mkdirSync(at('repo', 'p'))
      symlinkSync(at('elsewhere', 'meta'), at('repo', 'p', '.claude-plugin'))
      expect(classifyAgentFile(at('repo', 'p', 'agents', 'a.md'))).toBeNull()
      expect(classifyOutputStyle(at('repo', 'p', 'output-styles', 's.md'))).toBeNull()
    })
  },
)
