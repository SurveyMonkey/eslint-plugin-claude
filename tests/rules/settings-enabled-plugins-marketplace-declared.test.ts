// The rule reads `enabledPlugins` and the marketplace names that the two project files declare
// together. The files glob and the decoy files are in tests/configs.test.ts.
import { mkdirSync, symlinkSync } from 'node:fs'
import path from 'node:path'
import jsonPlugin from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { repo } from '../agent-settings.test-support.ts'
import { chmodCannotBlock, lintJson, withoutAccess } from '../rule-tester.test-support.ts'

const name = 'settings-enabled-plugins-marketplace-declared'
const SETTINGS = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const json = JSON.stringify

/** The message ids of the rule for the text `code` at `file` of a repository that holds `files`. */
function idsAt(files: Record<string, string>, code: unknown, file = SETTINGS) {
  const root = repo(files)
  const text = typeof code === 'string' ? code : json(code)
  return lintJson(name, text, path.join(root, file)).map((message) => message.messageId)
}
const enable = (...keys: string[]) => ({
  enabledPlugins: Object.fromEntries(keys.map((key) => [key, true])),
})
const declare = (...markets: string[]) => ({
  extraKnownMarketplaces: Object.fromEntries(
    markets.map((market) => [market, { source: { source: 'github', repo: 'a/b' } }]),
  ),
})

describe(`${name} (silent)`, () => {
  it('is silent for a marketplace that the same file declares', () => {
    expect(idsAt({}, { ...enable('p@acme'), ...declare('acme') })).toEqual([])
    expect(idsAt({}, { ...enable('p@acme'), ...declare('acme') }, LOCAL)).toEqual([])
  })

  it('is silent for a marketplace that the other project file declares', () => {
    expect(idsAt({ [LOCAL]: json(declare('acme')) }, enable('p@acme'))).toEqual([])
    expect(idsAt({ [SETTINGS]: json(declare('acme')) }, enable('p@acme'), LOCAL)).toEqual([])
  })

  it('is silent for the alias additionalMarketplaces, in the file and in the other file', () => {
    const alias = { additionalMarketplaces: declare('acme').extraKnownMarketplaces }
    expect(idsAt({}, { ...enable('p@acme'), ...alias })).toEqual([])
    expect(idsAt({ [LOCAL]: json(alias) }, enable('p@acme'))).toEqual([])
  })

  it('is silent for the official marketplace and the origins of a plugin that has no marketplace', () => {
    expect(
      idsAt(
        {},
        enable(
          'p@claude-plugins-official',
          'p@inline',
          'p@skills-dir',
          'p@synced',
          'p@builtin',
          'p@claude-plugin-test',
        ),
      ),
    ).toEqual([])
  })

  it('is silent for a plugin set to false, because it blocks the plugin', () => {
    expect(idsAt({}, { enabledPlugins: { 'p@acme': false } })).toEqual([])
  })

  it('is silent for a value that is not a Boolean', () => {
    expect(
      idsAt({}, { enabledPlugins: { 'p@acme': 'true', 'q@acme': null, 'r@acme': 1 } }),
    ).toEqual([])
  })

  it('is silent for a key that settings-enabled-plugins-schema reports', () => {
    expect(idsAt({}, enable('p', '@acme', 'p@', 'p@a@b', ''))).toEqual([])
  })

  it('is silent for a file with no enabledPlugins, or a value that is not an object', () => {
    expect(idsAt({}, { model: 'x' })).toEqual([])
    expect(idsAt({}, '[1]')).toEqual([])
    expect(idsAt({}, { enabledPlugins: ['p@acme'] })).toEqual([])
    expect(idsAt({}, { enabledPlugins: null })).toEqual([])
  })

  it('is silent when the other file does not parse to an object', () => {
    for (const text of ['[1]', 'null', '1', '"x"', '{']) {
      expect(idsAt({ [LOCAL]: text }, enable('p@acme'))).toEqual([])
      expect(idsAt({ [SETTINGS]: text }, enable('p@acme'), LOCAL)).toEqual([])
    }
  })

  it('is silent when the other file is a dangling link', () => {
    const root = repo({})
    mkdirSync(path.join(root, '.claude'))
    symlinkSync(path.join(root, 'gone.json'), path.join(root, LOCAL))
    expect(lintJson(name, json(enable('p@acme')), path.join(root, SETTINGS))).toEqual([])
  })

  it('is silent when the other file cannot be read', { skip: chmodCannotBlock }, () => {
    const root = repo({ [LOCAL]: '{}' })
    withoutAccess(path.join(root, LOCAL), () => {
      expect(lintJson(name, json(enable('p@acme')), path.join(root, SETTINGS))).toEqual([])
    })
  })

  it('is silent for text that JSON.parse rejects, such as a comment in a JSONC file', () => {
    const root = repo({})
    const messages = new Linter({ cwd: path.parse(root).root }).verify(
      '{\n  // comment\n  "enabledPlugins": {"p@acme": true}\n}',
      [
        {
          files: ['**/*.json'],
          plugins: { json: jsonPlugin, claude: plugin },
          language: 'json/jsonc',
          rules: { [`claude/${name}`]: 'error' },
        },
      ],
      { filename: path.join(root, SETTINGS) },
    )
    expect(messages).toEqual([])
  })
})

describe(`${name} (reports)`, () => {
  it('reports a marketplace that no committed file declares', () => {
    expect(idsAt({}, enable('p@acme'))).toEqual(['undeclared'])
    expect(idsAt({}, enable('p@acme'), LOCAL)).toEqual(['undeclared'])
  })

  it('reports at the key, and names it', () => {
    const root = repo({})
    const text =
      '{\n  "enabledPlugins": {\n    "p@claude-plugins-official": true,\n    "q@acme": true\n  }\n}'
    const messages = lintJson(name, text, path.join(root, SETTINGS))
    expect(messages.map((m) => [m.line, m.column, m.message])).toEqual([
      [
        4,
        5,
        'The "enabledPlugins" key "q@acme" names the marketplace "acme", and no project settings file declares it in "extraKnownMarketplaces". A teammate who has not added it gets no plugin.',
      ],
    ])
  })

  it('reports each undeclared plugin once, and not a declared one', () => {
    const code = { ...enable('a@one', 'b@two', 'c@one'), ...declare('two') }
    expect(idsAt({}, code)).toEqual(['undeclared', 'undeclared'])
  })

  it('reports a marketplace that the other file declares under another name', () => {
    expect(idsAt({ [LOCAL]: json(declare('other')) }, enable('p@acme'))).toEqual(['undeclared'])
  })

  it('reports a marketplace whose entry is null, because null removes the entry', () => {
    expect(idsAt({}, { ...enable('p@acme'), extraKnownMarketplaces: { acme: null } })).toEqual([
      'undeclared',
    ])
    expect(
      idsAt({ [LOCAL]: json({ extraKnownMarketplaces: { acme: null } }) }, enable('p@acme')),
    ).toEqual(['undeclared'])
  })

  it('reports a name that only an inherited property of the declaring value has', () => {
    expect(idsAt({}, { ...enable('p@constructor'), extraKnownMarketplaces: {} })).toEqual([
      'undeclared',
    ])
    expect(idsAt({}, { ...enable('p@length'), extraKnownMarketplaces: [] })).toEqual(['undeclared'])
    expect(idsAt({}, { ...enable('p@toString'), extraKnownMarketplaces: null })).toEqual([
      'undeclared',
    ])
  })

  it('reads the canonical key and not the alias when a file sets both', () => {
    const both = {
      ...enable('p@acme'),
      extraKnownMarketplaces: {},
      additionalMarketplaces: declare('acme').extraKnownMarketplaces,
    }
    expect(idsAt({}, both)).toEqual(['undeclared'])
    expect(idsAt({ [LOCAL]: json(both) }, enable('p@acme'))).toEqual(['undeclared'])
  })

  it('reports when a declaring key is not an object', () => {
    expect(idsAt({}, { ...enable('p@acme'), extraKnownMarketplaces: ['acme'] })).toEqual([
      'undeclared',
    ])
    expect(idsAt({ [LOCAL]: json({ extraKnownMarketplaces: 'acme' }) }, enable('p@acme'))).toEqual([
      'undeclared',
    ])
  })

  it('reads the file text and not the copy on the disk', () => {
    expect(
      idsAt({ [SETTINGS]: json({ ...enable('p@acme'), ...declare('acme') }) }, enable('p@acme')),
    ).toEqual(['undeclared'])
  })

  it('reads the last of two keys of one name', () => {
    const text = '{"enabledPlugins": {"p@acme": true, "p@acme": false}}'
    expect(idsAt({}, text)).toEqual([])
    const reverse = '{"enabledPlugins": {"p@acme": false, "p@acme": true}}'
    expect(idsAt({}, reverse)).toEqual(['undeclared'])
  })
})
