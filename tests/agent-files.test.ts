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

// The manifest key `agents` names the agent files of a plugin. It replaces the `agents/`
// directory scan. A path starts with `./`, ends in `.md`, and stays in the plugin root.
describe('the manifest key agents', () => {
  /** A repository with a plugin at `p`. The manifest is `manifest`, with the plugin name added. */
  const manifested = (name: string, manifest: object | string) => {
    mkdirSync(at(name, '.git'), { recursive: true })
    mkdirSync(at(name, 'p', '.claude-plugin'), { recursive: true })
    writeFileSync(
      at(name, 'p', '.claude-plugin', 'plugin.json'),
      typeof manifest === 'string' ? manifest : JSON.stringify({ name: 'p', ...manifest }),
    )
    return at(name, 'p')
  }

  it('sees a file that the manifest names, outside agents/', () => {
    const root = manifested('m1', { agents: ['./custom/reviewer.md', './custom/deep/x.md'] })
    expect(classifyAgentFile(path.join(root, 'custom', 'reviewer.md'))).toEqual({
      plugin: true,
      root,
    })
    expect(classifyAgentFile(path.join(root, 'custom', 'deep', 'x.md'))).toEqual({
      plugin: true,
      root,
    })
  })

  it('reads the string form', () => {
    const root = manifested('m2', { agents: './custom/reviewer.md' })
    expect(classifyAgentFile(path.join(root, 'custom', 'reviewer.md'))).toEqual({
      plugin: true,
      root,
    })
  })

  it('sees a file in agents/ that the manifest names, and none that it leaves out', () => {
    const root = manifested('m3', { agents: ['./agents/team/x.md'] })
    expect(classifyAgentFile(path.join(root, 'agents', 'team', 'x.md'))).toEqual({
      plugin: true,
      root,
    })
    expect(classifyAgentFile(path.join(root, 'agents', 'other.md'))).toBeNull()
    expect(classifyAgentFile(path.join(root, 'custom', 'other.md'))).toBeNull()
  })

  it('keeps the agents/ directory when the manifest has no agents key', () => {
    const root = manifested('m4', { skills: ['./extra/'] })
    expect(classifyAgentFile(path.join(root, 'agents', 'a.md'))).toEqual({ plugin: true, root })
    expect(classifyAgentFile(path.join(root, 'custom', 'a.md'))).toBeNull()
  })

  it('sees no file for a path that the plugin does not load', () => {
    const root = manifested('m5', {
      agents: ['custom/a.md', './custom/b.txt', './custom', './custom/../../c.md'],
    })
    for (const file of ['a.md', 'b.txt', 'b.md', 'c.md']) {
      expect(classifyAgentFile(path.join(root, 'custom', file))).toBeNull()
    }
    expect(classifyAgentFile(path.join(root, 'agents', 'a.md'))).toBeNull()
  })

  it('sees no file for a path that leaves the plugin', () => {
    const root = manifested('m6', { agents: ['../outside/a.md'] })
    expect(classifyAgentFile(path.join(path.dirname(root), 'outside', 'a.md'))).toBeNull()
  })

  it('keeps agents/ for a manifest that is no list of paths, and sees no other file', () => {
    for (const [index, agents] of [5, { a: 1 }, ['./custom/a.md', 5], true].entries()) {
      const root = manifested(`m7-${index}`, { agents })
      expect(classifyAgentFile(path.join(root, 'agents', 'a.md'))).toEqual({ plugin: true, root })
      expect(classifyAgentFile(path.join(root, 'custom', 'a.md'))).toBeNull()
    }
    const text = manifested('m8', '{')
    expect(classifyAgentFile(path.join(text, 'agents', 'a.md'))).toEqual({
      plugin: true,
      root: text,
    })
    expect(classifyAgentFile(path.join(text, 'custom', 'a.md'))).toBeNull()
  })

  it('uses the plugin root nearest to the file', () => {
    const outer = manifested('m9', { agents: ['./inner/custom/a.md'] })
    mkdirSync(path.join(outer, 'inner', '.claude-plugin'), { recursive: true })
    writeFileSync(path.join(outer, 'inner', '.claude-plugin', 'plugin.json'), '{"name":"i"}')
    expect(classifyAgentFile(path.join(outer, 'inner', 'custom', 'a.md'))).toBeNull()
  })

  it('sees no file when the plugin root is not a plugin', () => {
    mkdirSync(at('m10', '.git'), { recursive: true })
    expect(classifyAgentFile(at('m10', 'p', 'custom', 'a.md'))).toBeNull()
  })

  it('does not climb above the repository root to a manifest', () => {
    mkdirSync(at('m11', 'repo', '.git'), { recursive: true })
    mkdirSync(at('m11', '.claude-plugin'), { recursive: true })
    writeFileSync(
      at('m11', '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'o', agents: ['./repo/custom/a.md'] }),
    )
    expect(classifyAgentFile(at('m11', 'repo', 'custom', 'a.md'))).toBeNull()
  })

  it('checks only its own folder when no .git is above', () => {
    mkdirSync(at('m12', 'p', '.claude-plugin'), { recursive: true })
    writeFileSync(
      at('m12', 'p', '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'p', agents: ['./a.md', './deep/a.md'] }),
    )
    expect(classifyAgentFile(at('m12', 'p', 'a.md'))).toEqual({
      plugin: true,
      root: at('m12', 'p'),
    })
    mkdirSync(at('m12', 'p', 'deep'), { recursive: true })
    expect(classifyAgentFile(at('m12', 'p', 'deep', 'a.md'))).toBeNull()
  })

  describe.skipIf(process.platform === 'win32')('with a link', () => {
    it('sees a file that is a link inside the repository', () => {
      const root = manifested('m13', { agents: ['./custom/link.md'] })
      mkdirSync(path.join(root, 'custom'), { recursive: true })
      writeFileSync(path.join(root, 'real.md'), 'x')
      symlinkSync(path.join(root, 'real.md'), path.join(root, 'custom', 'link.md'))
      expect(classifyAgentFile(path.join(root, 'custom', 'link.md'))).toEqual({
        plugin: true,
        root,
      })
    })

    it('sees no file that is a link out of the repository, or a dangling link', () => {
      const root = manifested('m14', { agents: ['./custom/out.md', './custom/gone.md'] })
      mkdirSync(path.join(root, 'custom'), { recursive: true })
      writeFileSync(at('m14-target.md'), 'x')
      symlinkSync(at('m14-target.md'), path.join(root, 'custom', 'out.md'))
      symlinkSync('missing.md', path.join(root, 'custom', 'gone.md'))
      expect(classifyAgentFile(path.join(root, 'custom', 'out.md'))).toBeNull()
      expect(classifyAgentFile(path.join(root, 'custom', 'gone.md'))).toBeNull()
    })
  })

  describe.skipIf(process.platform === 'win32')('with a link out of the plugin', () => {
    it('sees no file that is a link out of the plugin root, inside the repository', () => {
      // The target is in the repository, so the bound does not hide it. The plugin root does.
      mkdirSync(at('m18', '.git'), { recursive: true })
      mkdirSync(at('m18', 'p', 'custom'), { recursive: true })
      mkdirSync(at('m18', 'p', '.claude-plugin'), { recursive: true })
      writeFileSync(
        at('m18', 'p', '.claude-plugin', 'plugin.json'),
        JSON.stringify({ agents: ['./custom/link.md'] }),
      )
      mkdirSync(at('m18', 'sibling'), { recursive: true })
      writeFileSync(at('m18', 'sibling', 'real.md'), 'x')
      symlinkSync(at('m18', 'sibling', 'real.md'), at('m18', 'p', 'custom', 'link.md'))
      expect(classifyAgentFile(at('m18', 'p', 'custom', 'link.md'))).toBeNull()
    })
  })

  it('sees a file of a plugin whose root is the root of the repository', () => {
    mkdirSync(at('m19', '.git'), { recursive: true })
    mkdirSync(at('m19', '.claude-plugin'), { recursive: true })
    writeFileSync(
      at('m19', '.claude-plugin', 'plugin.json'),
      JSON.stringify({ agents: ['./custom/a.md'] }),
    )
    expect(classifyAgentFile(at('m19', 'custom', 'a.md'))).toEqual({
      plugin: true,
      root: at('m19'),
    })
  })

  describe.skipIf(chmodCannotBlock)('with no access to a folder', () => {
    it('does not go on to a plugin root above a plugin root that it cannot see', () => {
      const outer = manifested('m16', { agents: ['./inner/custom/a.md'] })
      mkdirSync(path.join(outer, 'inner', 'custom'), { recursive: true })
      mkdirSync(path.join(outer, 'inner', '.claude-plugin'), { recursive: true })
      writeFileSync(path.join(outer, 'inner', '.claude-plugin', 'plugin.json'), '{"name":"i"}')
      // The outer manifest names the file, so the file is an agent unless the inner root hides it.
      expect(classifyAgentFile(path.join(outer, 'inner', 'custom', 'a.md'))).toBeNull()
      withoutAccess(path.join(outer, 'inner', '.claude-plugin'), () => {
        expect(classifyAgentFile(path.join(outer, 'inner', 'custom', 'a.md'))).toBeNull()
      })
    })
  })

  describe.skipIf(chmodCannotBlock)('with no access to the file', () => {
    it('sees no file that it cannot reach', () => {
      const root = manifested('m15', { agents: ['./custom/locked/a.md'] })
      mkdirSync(path.join(root, 'custom', 'locked'), { recursive: true })
      writeFileSync(path.join(root, 'custom', 'locked', 'a.md'), 'x')
      withoutAccess(path.join(root, 'custom', 'locked'), () => {
        expect(classifyAgentFile(path.join(root, 'custom', 'locked', 'a.md'))).toBeNull()
      })
    })
  })
})
