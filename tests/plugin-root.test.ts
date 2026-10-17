import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isPluginRoot } from '../src/plugin-root.ts'
import { UNREADABLE } from '../src/skill-tree.ts'
import { chmodCannotBlock, withoutAccess } from './rule-tester.test-support.ts'

// `repo/` is the repository. `outside/` is a sibling that holds the targets of links.
let scratch = ''
beforeEach(() => {
  scratch = mkdtempSync(path.join(tmpdir(), 'plugin-root-'))
  mkdirSync(path.join(scratch, 'repo', '.git'), { recursive: true })
  mkdirSync(path.join(scratch, 'outside'))
})
afterEach(() => rmSync(scratch, { recursive: true, force: true }))

const repo = (...parts: string[]) => path.join(scratch, 'repo', ...parts)
const outside = (...parts: string[]) => path.join(scratch, 'outside', ...parts)
const put = (file: string, text = '{}') => {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, text)
  return file
}

it('is a plugin root when it holds a manifest file', () => {
  put(repo('p', '.claude-plugin', 'plugin.json'))
  expect(isPluginRoot(repo('p'))).toBe(true)
})

it('is not a plugin root when the manifest is absent', () => {
  mkdirSync(repo('q', '.claude-plugin'), { recursive: true })
  mkdirSync(repo('r'), { recursive: true })
  put(repo('s', '.claude-plugin'), 'a file, not a directory')
  expect(isPluginRoot(repo('q'))).toBe(false)
  expect(isPluginRoot(repo('r'))).toBe(false)
  expect(isPluginRoot(repo('s'))).toBe(false)
  expect(isPluginRoot(repo('none'))).toBe(false)
  expect(isPluginRoot(repo())).toBe(false)
})

describe.skipIf(process.platform === 'win32')('a link', () => {
  it('is a plugin root when the manifest is a link to a file out of the repository', () => {
    const target = put(outside('plugin.json'))
    mkdirSync(repo('p', '.claude-plugin'), { recursive: true })
    symlinkSync(target, repo('p', '.claude-plugin', 'plugin.json'))
    expect(isPluginRoot(repo('p'))).toBe(true)
  })

  it('is a plugin root when the manifest is a dangling link', () => {
    mkdirSync(repo('p', '.claude-plugin'), { recursive: true })
    symlinkSync('missing.json', repo('p', '.claude-plugin', 'plugin.json'))
    expect(isPluginRoot(repo('p'))).toBe(true)
  })

  it('is a plugin root when the manifest is a link to a directory', () => {
    mkdirSync(repo('p', '.claude-plugin'), { recursive: true })
    symlinkSync(repo(), repo('p', '.claude-plugin', 'plugin.json'))
    expect(isPluginRoot(repo('p'))).toBe(true)
  })

  it('is unseen when `.claude-plugin/` is a link to a directory out of the repository', () => {
    put(outside('meta', 'plugin.json'))
    mkdirSync(repo('p'), { recursive: true })
    symlinkSync(outside('meta'), repo('p', '.claude-plugin'))
    expect(isPluginRoot(repo('p'))).toBe(UNREADABLE)
  })

  it('is a plugin root when `.claude-plugin/` is a link to a directory in the repository', () => {
    put(repo('shared', 'plugin.json'))
    mkdirSync(repo('p'), { recursive: true })
    symlinkSync(repo('shared'), repo('p', '.claude-plugin'))
    expect(isPluginRoot(repo('p'))).toBe(true)
  })

  it('is not a plugin root when `.claude-plugin/` is a dangling link', () => {
    mkdirSync(repo('p'), { recursive: true })
    symlinkSync('missing', repo('p', '.claude-plugin'))
    expect(isPluginRoot(repo('p'))).toBe(false)
  })
})

describe.skipIf(chmodCannotBlock)('a path that the check cannot read', () => {
  it('is unseen when `.claude-plugin/` cannot be searched', () => {
    put(repo('p', '.claude-plugin', 'plugin.json'))
    withoutAccess(repo('p', '.claude-plugin'), () => {
      expect(isPluginRoot(repo('p'))).toBe(UNREADABLE)
    })
    expect(isPluginRoot(repo('p'))).toBe(true)
  })

  it('is unseen when the directory above `.claude-plugin/` cannot be searched', () => {
    put(repo('p', '.claude-plugin', 'plugin.json'))
    withoutAccess(repo('p'), () => {
      expect(isPluginRoot(repo('p'))).toBe(UNREADABLE)
    })
  })
})

describe('a directory that a marketplace lists with no manifest', () => {
  /** Write `repo/<at>/.claude-plugin/marketplace.json` with the entries `plugins`. */
  const market = (at: string, plugins: unknown[], metadata?: object) =>
    put(
      repo(at, '.claude-plugin', 'marketplace.json'),
      JSON.stringify({ name: 'm', metadata, plugins }),
    )

  it('is a plugin root when a marketplace above it lists it', () => {
    market('.', [{ name: 'p', source: './plugins/p' }])
    put(repo('plugins', 'p', 'commands', 'x.md'), '# X\n')
    mkdirSync(repo('plugins', 'q', 'commands'), { recursive: true })
    expect(isPluginRoot(repo('plugins', 'p'))).toBe(true)
    // A directory that no entry lists, and the directory that holds the plugins, stay out.
    expect(isPluginRoot(repo('plugins', 'q'))).toBe(false)
    expect(isPluginRoot(repo('plugins'))).toBe(false)
    expect(isPluginRoot(repo('plugins', 'p', 'commands'))).toBe(false)
  })

  it('is a plugin root when a nested marketplace lists it, or lists a bare name under pluginRoot', () => {
    market(
      'packages/m',
      [
        { name: 'a', source: 'a' },
        { name: 'b', source: './b' },
      ],
      {
        pluginRoot: './plugins',
      },
    )
    mkdirSync(repo('packages', 'm', 'plugins', 'a'), { recursive: true })
    mkdirSync(repo('packages', 'm', 'b'), { recursive: true })
    expect(isPluginRoot(repo('packages', 'm', 'plugins', 'a'))).toBe(true)
    expect(isPluginRoot(repo('packages', 'm', 'b'))).toBe(true)
  })

  it('is a plugin root at the marketplace root when an entry lists "."', () => {
    market('.', [{ name: 'self', source: '.' }])
    expect(isPluginRoot(repo())).toBe(true)
  })

  it('is not a plugin root for a remote source, a ".." path, or a file that does not parse', () => {
    market('.', [
      { name: 'r', source: { source: 'github', repo: 'o/r' } },
      { name: 'u', source: '../outside' },
      { name: 'n', source: 'p' },
    ])
    mkdirSync(repo('p'), { recursive: true })
    mkdirSync(path.join(scratch, 'outside'), { recursive: true })
    expect(isPluginRoot(repo('p'))).toBe(false)
    put(repo('packages', 'bad', '.claude-plugin', 'marketplace.json'), '{ "plugins": [')
    mkdirSync(repo('packages', 'bad', 'p'), { recursive: true })
    expect(isPluginRoot(repo('packages', 'bad', 'p'))).toBe(false)
  })

  it('reads no marketplace above the directory when no `.git` marks the repository', () => {
    rmSync(repo('.git'), { recursive: true })
    market('.', [{ name: 'p', source: './p' }])
    market('own', [{ name: 'self', source: '.' }])
    mkdirSync(repo('p'), { recursive: true })
    expect(isPluginRoot(repo('p'))).toBe(false)
    expect(isPluginRoot(repo('own'))).toBe(true)
  })

  it('shows a change to the marketplace, and a listed directory that a user adds later', () => {
    market('.', [{ name: 'p', source: './p' }])
    // The check of `q` reads the marketplace while `p` is not there.
    mkdirSync(repo('q'))
    expect(isPluginRoot(repo('q'))).toBe(false)
    mkdirSync(repo('p'))
    expect(isPluginRoot(repo('p'))).toBe(true)
    expect(isPluginRoot(repo('p'))).toBe(true)
    // A new size gives a new stamp, so the entry list is read again.
    market('.', [
      { name: 'other', source: './other' },
      { name: 'more', source: './more' },
    ])
    expect(isPluginRoot(repo('p'))).toBe(false)
  })
})

describe.skipIf(process.platform === 'win32')('a listed source that is a link', () => {
  it('is not a plugin root when the link leads out of the repository', () => {
    put(
      repo('.claude-plugin', 'marketplace.json'),
      JSON.stringify({ plugins: [{ name: 'p', source: './p' }] }),
    )
    mkdirSync(outside('p'))
    symlinkSync(outside('p'), repo('p'))
    expect(isPluginRoot(repo('p'))).toBe(false)
    expect(isPluginRoot(outside('p'))).toBe(false)
  })

  it('is a plugin root at the target when the link stays in the marketplace', () => {
    put(
      repo('.claude-plugin', 'marketplace.json'),
      JSON.stringify({ plugins: [{ name: 'p', source: './p' }] }),
    )
    mkdirSync(repo('shared', 'p'), { recursive: true })
    symlinkSync(repo('shared', 'p'), repo('p'))
    expect(isPluginRoot(repo('p'))).toBe(true)
    expect(isPluginRoot(repo('shared', 'p'))).toBe(true)
  })
})
