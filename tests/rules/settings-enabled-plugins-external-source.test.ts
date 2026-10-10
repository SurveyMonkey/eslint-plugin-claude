// The rule reads `enabledPlugins` of `.claude/settings.json`, the marketplace that the project
// settings declare, and the `marketplace.json` that a `file` or `directory` source names. The files
// glob and the decoy files are in tests/configs.test.ts.
import { mkdirSync, symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'settings-enabled-plugins-external-source'
const SETTINGS = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const MARKET = 'm/.claude-plugin/marketplace.json'
const json = JSON.stringify

/** The message ids of the rule for the text `code` at `file` of a repository that holds `files`. */
function idsAt(files: Record<string, string>, code: unknown, file = SETTINGS) {
  const root = repo(files)
  const text = typeof code === 'string' ? code : json(code)
  return lintJson(name, text, path.join(root, file)).map((message) => message.messageId)
}
const directory = { source: 'directory', path: './m' }
const declare = (source: unknown = directory, market = 'acme') => ({
  extraKnownMarketplaces: { [market]: { source } },
})
const enable = (...keys: string[]) => ({
  enabledPlugins: Object.fromEntries(keys.map((key) => [key, true])),
})
const external = { source: 'github', repo: 'acme/p' }
const market = (...plugins: unknown[]) => ({ [MARKET]: json({ name: 'acme', plugins }) })
const entry = (pluginName: string, source: unknown) => ({ name: pluginName, source })

describe(`${name} (silent)`, () => {
  it('is silent for an entry with a relative path', () => {
    const files = market(entry('p', './plugins/p'))
    expect(idsAt(files, { ...declare(), ...enable('p@acme') })).toEqual([])
  })

  it('is silent for an entry with a bare name or a path that starts without ./', () => {
    const files = market(entry('p', 'p'), entry('q', 'plugins/q'), entry('r', '.'))
    expect(idsAt(files, { ...declare(), ...enable('p@acme', 'q@acme', 'r@acme') })).toEqual([])
  })

  it('is silent when the plugin has no entry, because entry-exists owns it', () => {
    const files = market(entry('other', external))
    expect(idsAt(files, { ...declare(), ...enable('p@acme') })).toEqual([])
  })

  it('is silent for a plugin set to false, or a value that is not a Boolean', () => {
    const files = market(entry('p', external))
    const plugins = { 'p@acme': false, 'q@acme': 'true', 'r@acme': null, 's@acme': 1 }
    expect(idsAt(files, { ...declare(), enabledPlugins: plugins })).toEqual([])
  })

  it('is silent when one entry of the name has a relative path', () => {
    const files = market(entry('p', external), entry('p', './plugins/p'))
    expect(idsAt(files, { ...declare(), ...enable('p@acme') })).toEqual([])
  })

  it('is silent for an entry whose source is no object and no string', () => {
    const files = market(entry('a', null), entry('b', [external]), entry('c', 1), { name: 'd' })
    expect(
      idsAt(files, { ...declare(), ...enable('a@acme', 'b@acme', 'c@acme', 'd@acme') }),
    ).toEqual([])
  })

  it('is silent for a marketplace that is not in the repository', () => {
    const files = market(entry('p', external))
    for (const source of [
      { source: 'github', repo: 'a/b' },
      { source: 'directory', path: '/abs/m' },
      { source: 'directory', path: '' },
      { source: 'directory' },
      'directory',
      null,
    ]) {
      expect(idsAt(files, { ...declare(source), ...enable('p@acme') })).toEqual([])
    }
  })

  it('is silent for a marketplace that no committed file declares', () => {
    const files = market(entry('p', external))
    expect(idsAt(files, enable('p@acme'))).toEqual([])
    expect(idsAt(files, { ...declare(directory, 'other'), ...enable('p@acme') })).toEqual([])
  })

  it('is silent when the marketplace.json is not there, or cannot be read', () => {
    expect(idsAt({}, { ...declare(), ...enable('p@acme') })).toEqual([])
    for (const text of ['{', '[1]', 'null', '"x"']) {
      expect(idsAt({ [MARKET]: text }, { ...declare(), ...enable('p@acme') })).toEqual([])
    }
  })

  it('is silent when the marketplace.json is a dangling link', () => {
    const root = repo({})
    mkdirSync(path.join(root, 'm/.claude-plugin'), { recursive: true })
    symlinkSync(path.join(root, 'gone.json'), path.join(root, MARKET))
    const code = json({ ...declare(), ...enable('p@acme') })
    expect(lintJson(name, code, path.join(root, SETTINGS))).toEqual([])
  })

  it('is silent when plugins is not an array', () => {
    const files = {
      [MARKET]: json({ name: 'acme', plugins: { p: { name: 'p', source: external } } }),
    }
    expect(idsAt(files, { ...declare(), ...enable('p@acme') })).toEqual([])
    expect(
      idsAt({ [MARKET]: json({ name: 'acme' }) }, { ...declare(), ...enable('p@acme') }),
    ).toEqual([])
  })

  it('is silent for an entry that is no object, or has no string name', () => {
    const files = market('p', null, { source: external }, { name: 1, source: external })
    expect(idsAt(files, { ...declare(), ...enable('p@acme', '1@acme') })).toEqual([])
  })

  it('is silent for a key that settings-enabled-plugins-schema reports', () => {
    const files = market(entry('p', external))
    expect(idsAt(files, { ...declare(), ...enable('p', '@acme', 'p@', 'p@a@b', '') })).toEqual([])
  })

  it('is silent for a plugin or marketplace name that is a property of an object', () => {
    const files = market(entry('p', external))
    expect(idsAt(files, { ...declare(), ...enable('constructor@acme') })).toEqual([])
    expect(
      idsAt(files, { extraKnownMarketplaces: {}, ...enable('p@constructor', 'p@toString') }),
    ).toEqual([])
  })

  it('is silent for a file with no enabledPlugins, or a value that is not an object', () => {
    expect(idsAt({}, { model: 'x' })).toEqual([])
    expect(idsAt({}, '[1]')).toEqual([])
    expect(idsAt({}, { enabledPlugins: ['p@acme'] })).toEqual([])
    expect(idsAt({}, { enabledPlugins: null })).toEqual([])
  })

  it('is silent when settings.local.json declares a marketplace that is not local', () => {
    const files = { ...market(entry('p', external)), [LOCAL]: json(declare({ source: 'github' })) }
    expect(idsAt(files, { ...declare(), ...enable('p@acme') })).toEqual([])
  })
})

describe(`${name} (reports)`, () => {
  it('reports an entry with an object source, for a directory source', () => {
    const files = market(entry('p', external))
    expect(idsAt(files, { ...declare(), ...enable('p@acme') })).toEqual(['external'])
  })

  it('reports each type of object source', () => {
    const sources = [
      { source: 'url', url: 'https://x.test/p.git' },
      { source: 'git-subdir', url: 'https://x.test/p.git', path: 'p' },
      { source: 'npm', package: 'p' },
      { source: 'archive', url: 'https://x.test/p.zip' },
      { source: 'command', command: 'tool' },
      {},
    ]
    for (const source of sources) {
      expect(idsAt(market(entry('p', source)), { ...declare(), ...enable('p@acme') })).toEqual([
        'external',
      ])
    }
  })

  it('reports for a file source', () => {
    const file = { source: 'file', path: `./${MARKET}` }
    expect(idsAt(market(entry('p', external)), { ...declare(file), ...enable('p@acme') })).toEqual([
      'external',
    ])
  })

  it('reports each external plugin, and not a relative one', () => {
    const files = market(entry('a', external), entry('b', './b'), entry('c', external))
    const code = { ...declare(), ...enable('a@acme', 'b@acme', 'c@acme') }
    expect(idsAt(files, code)).toEqual(['external', 'external'])
  })

  it('reports when two entries of one name are both external', () => {
    const files = market(entry('p', external), entry('p', { source: 'npm', package: 'p' }))
    expect(idsAt(files, { ...declare(), ...enable('p@acme') })).toEqual(['external'])
  })

  it('reports at the key, and names the plugin and the marketplace', () => {
    const root = repo(market(entry('p', external)))
    const text = `{
  "extraKnownMarketplaces": {"acme": {"source": {"source": "directory", "path": "./m"}}},
  "enabledPlugins": {"p@acme": true}
}`
    const messages = lintJson(name, text, path.join(root, SETTINGS))
    expect(messages.map((m) => [m.line, m.column, m.message])).toEqual([
      [
        3,
        22,
        'The plugin "p" is enabled here, and its entry in the marketplace "acme" has an external source. Claude Code does not install it from the project settings alone. Each teammate must run "claude plugin install p@acme --scope project", or the entry needs a relative path.',
      ],
    ])
  })

  it('uses the marketplace that settings.local.json declares, as declaredSource does', () => {
    const files = { ...market(entry('p', external)), [LOCAL]: json(declare()) }
    expect(idsAt(files, enable('p@acme'))).toEqual(['external'])
    const overridden = { ...market(entry('p', external)), [LOCAL]: json(declare({ source: 'x' })) }
    expect(idsAt(overridden, { ...declare(), ...enable('p@acme') })).toEqual([])
  })

  it('reads the file text and not the copy on the disk', () => {
    const files = {
      ...market(entry('p', external)),
      [SETTINGS]: json({ ...declare(), ...enable('p@acme') }),
    }
    expect(idsAt(files, enable('p@acme'))).toEqual([])
  })

  it('reads the last of two keys of one name', () => {
    const files = market(entry('p', external))
    const key = `${json(declare()).slice(1, -1)}, "enabledPlugins": {"p@acme": true, "p@acme": false}`
    expect(idsAt(files, `{${key}}`)).toEqual([])
    const reverse = `${json(declare()).slice(1, -1)}, "enabledPlugins": {"p@acme": false, "p@acme": true}`
    expect(idsAt(files, `{${reverse}}`)).toEqual(['external'])
  })
})
