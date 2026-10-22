import { mkdirSync, mkdtempSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
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
      { name: 'other', source: './q' },
      { name: 'more', source: './more' },
    ])
    expect(isPluginRoot(repo('p'))).toBe(false)
    expect(isPluginRoot(repo('q'))).toBe(true)
  })

  it('shows an edit that keeps the size of the marketplace', () => {
    mkdirSync(repo('p'))
    mkdirSync(repo('q'))
    const file = market('.', [{ name: 'p', source: './p' }])
    expect(isPluginRoot(repo('p'))).toBe(true)
    market('.', [{ name: 'p', source: './q' }])
    // A file system with a coarse clock can give the two writes one time. Set a time far apart.
    utimesSync(file, new Date(2001, 0, 1), new Date(2001, 0, 1))
    expect(isPluginRoot(repo('p'))).toBe(false)
    expect(isPluginRoot(repo('q'))).toBe(true)
  })

  it('shows an edit that keeps the time of the last write of the marketplace', () => {
    mkdirSync(repo('p'))
    mkdirSync(repo('longer'))
    const file = market('.', [{ name: 'p', source: './p' }])
    const time = new Date(2001, 0, 1)
    utimesSync(file, time, time)
    expect(isPluginRoot(repo('p'))).toBe(true)
    market('.', [{ name: 'p', source: './longer' }])
    utimesSync(file, time, time)
    expect(isPluginRoot(repo('p'))).toBe(false)
    expect(isPluginRoot(repo('longer'))).toBe(true)
  })

  it('is not a plugin root after the marketplace is removed, or stops to parse', () => {
    mkdirSync(repo('p'))
    const file = market('.', [{ name: 'p', source: './p' }])
    expect(isPluginRoot(repo('p'))).toBe(true)
    rmSync(file)
    expect(isPluginRoot(repo('p'))).toBe(false)
    market('.', [{ name: 'p', source: './p' }])
    expect(isPluginRoot(repo('p'))).toBe(true)
    put(file, '{ "plugins": [')
    expect(isPluginRoot(repo('p'))).toBe(false)
    expect(isPluginRoot(repo('p'))).toBe(false)
  })

  it('is unseen when the entry sets a key that replaces a default location', () => {
    // Claude Code loads the plugin, but the checks read the component keys from `plugin.json`
    // only. So they cannot say where its components are.
    market('.', [
      { name: 'c', source: './c', commands: ['./x.md'] },
      { name: 'a', source: './a', agents: './agents/' },
      { name: 's', source: './s', skills: ['./skills/one'] },
      { name: 'o', source: './o', outputStyles: './styles/' },
      { name: 'w', source: './w', workflows: './flows/' },
      { name: 'e', source: './e', experimental: { themes: './themes/' } },
      { name: 't', source: './t', themes: './themes/' },
      { name: 'n', source: './n', monitors: './monitors.json' },
      { name: 'm', source: './m', mcpServers: { x: { command: 'x' } } },
    ])
    const replaced = ['c', 'a', 's', 'o', 'w', 'e', 't', 'n']
    for (const dir of [...replaced, 'm', 'q']) {
      mkdirSync(repo(dir))
    }
    for (const dir of replaced) {
      expect(isPluginRoot(repo(dir))).toBe(UNREADABLE)
    }
    // `mcpServers` merges with the default `.mcp.json`, so the default layout still loads.
    expect(isPluginRoot(repo('m'))).toBe(true)
    // No entry has the path of `q`.
    expect(isPluginRoot(repo('q'))).toBe(false)
  })

  it('is unseen when a second entry names the directory with a key that replaces a default', () => {
    const plain = { name: 'p', source: './p' }
    const replacing = { name: 'c', source: './p', commands: ['./x.md'] }
    mkdirSync(repo('p'))
    market('.', [replacing, plain])
    expect(isPluginRoot(repo('p'))).toBe(UNREADABLE)
    market('.', [plain, replacing])
    expect(isPluginRoot(repo('p'))).toBe(UNREADABLE)
  })

  it('is unseen when an outer marketplace has the replacing entry of a directory that an inner one lists', () => {
    mkdirSync(repo('in', 'p'), { recursive: true })
    market('in', [{ name: 'p', source: './p' }])
    market('.', [{ name: 'c', source: './in/p', commands: ['./x.md'] }])
    expect(isPluginRoot(repo('in', 'p'))).toBe(UNREADABLE)
    market('.', [{ name: 'c', source: './in/p' }])
    expect(isPluginRoot(repo('in', 'p'))).toBe(true)
    // An outer marketplace that lists another directory does not undo the inner listing.
    market('.', [{ name: 'o', source: './other' }])
    expect(isPluginRoot(repo('in', 'p'))).toBe(true)
  })

  it('is unseen when an inner marketplace has the replacing entry, and an outer one lists the directory', () => {
    mkdirSync(repo('in', 'p'), { recursive: true })
    market('in', [{ name: 'c', source: './p', commands: ['./x.md'] }])
    market('.', [{ name: 'p', source: './in/p' }])
    expect(isPluginRoot(repo('in', 'p'))).toBe(UNREADABLE)
  })

  it.skipIf(process.platform === 'win32')(
    'is unseen when an inner marketplace lists the directory, and the check cannot see an outer one',
    () => {
      mkdirSync(repo('in', 'p'), { recursive: true })
      market('in', [{ name: 'p', source: './p' }])
      mkdirSync(repo('.claude-plugin'))
      symlinkSync('missing.json', repo('.claude-plugin', 'marketplace.json'))
      expect(isPluginRoot(repo('in', 'p'))).toBe(UNREADABLE)
    },
  )

  it('is unseen when the marketplace is JSON that is too deep to read', () => {
    put(repo('.claude-plugin', 'marketplace.json'), `${'['.repeat(200_000)}${']'.repeat(200_000)}`)
    mkdirSync(repo('p'))
    expect(isPluginRoot(repo('p'))).toBe(UNREADABLE)
  })

  it('reads no marketplace above the repository root', () => {
    put(
      path.join(scratch, '.claude-plugin', 'marketplace.json'),
      JSON.stringify({ plugins: [{ name: 'p', source: './repo/p' }] }),
    )
    mkdirSync(repo('p'))
    expect(isPluginRoot(repo('p'))).toBe(false)
  })
})

describe.skipIf(process.platform === 'win32')('a listed source that is a link', () => {
  it('is unseen when the link leads out of the repository', () => {
    put(
      repo('.claude-plugin', 'marketplace.json'),
      JSON.stringify({ plugins: [{ name: 'p', source: './p' }] }),
    )
    mkdirSync(outside('p'))
    symlinkSync(outside('p'), repo('p'))
    mkdirSync(repo('q'))
    // The check cannot see the source, so it cannot tell if `p` is a plugin root.
    expect(isPluginRoot(repo('p'))).toBe(UNREADABLE)
    // No entry has the path of `q`.
    expect(isPluginRoot(repo('q'))).toBe(false)
    expect(isPluginRoot(outside('p'))).toBe(false)
  })

  it('is unseen when the marketplace is a dangling link, or a link out of the repository', () => {
    mkdirSync(repo('.claude-plugin'))
    mkdirSync(repo('p'))
    symlinkSync('missing.json', repo('.claude-plugin', 'marketplace.json'))
    expect(isPluginRoot(repo('p'))).toBe(UNREADABLE)
    rmSync(repo('.claude-plugin', 'marketplace.json'))
    put(outside('m.json'), JSON.stringify({ plugins: [{ name: 'p', source: './p' }] }))
    symlinkSync(outside('m.json'), repo('.claude-plugin', 'marketplace.json'))
    expect(isPluginRoot(repo('p'))).toBe(UNREADABLE)
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

describe.skipIf(chmodCannotBlock)('a marketplace or a source that the check cannot read', () => {
  const listing = JSON.stringify({ plugins: [{ name: 'p', source: './plugins/p' }] })

  it('is unseen when the marketplace cannot be read, and a root when it can again', () => {
    const file = put(repo('.claude-plugin', 'marketplace.json'), listing)
    mkdirSync(repo('plugins', 'p'), { recursive: true })
    withoutAccess(file, () => {
      expect(isPluginRoot(repo('plugins', 'p'))).toBe(UNREADABLE)
    })
    expect(isPluginRoot(repo('plugins', 'p'))).toBe(true)
  })

  it('reads a source again that the check could not see before', () => {
    put(repo('.claude-plugin', 'marketplace.json'), listing)
    mkdirSync(repo('plugins', 'p'), { recursive: true })
    mkdirSync(repo('q'))
    // The check of `q` reads the marketplace while `plugins/` cannot be searched. No entry has
    // the path of `q`, so it is not a plugin root.
    withoutAccess(repo('plugins'), () => {
      expect(isPluginRoot(repo('q'))).toBe(false)
    })
    expect(isPluginRoot(repo('plugins', 'p'))).toBe(true)
  })
})
