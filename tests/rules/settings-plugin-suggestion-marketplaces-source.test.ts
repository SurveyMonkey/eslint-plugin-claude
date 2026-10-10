// A `pluginSuggestionMarketplaces` name takes effect only when the same managed settings declare
// its source: an `extraKnownMarketplaces` entry of that name, or an entry of
// `strictKnownMarketplaces`. The managed settings page merges `managed-settings.json` and each
// `managed-settings.d/*.json` drop-in into one source. The rule reads the sibling files on disk.
import { mkdirSync, symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { chmodCannotBlock, lintJson, withoutAccess } from '../rule-tester.test-support.ts'

const name = 'settings-plugin-suggestion-marketplaces-source'
const MAIN = 'managed-settings.json'
const DROP = 'managed-settings.d'
const json = JSON.stringify

/** The message ids of the rule for the text `code` at `file` of a repository that holds `files`. */
function idsAt(files: Record<string, string>, code: unknown, file = MAIN) {
  const root = repo(files)
  const text = typeof code === 'string' ? code : json(code)
  return lintJson(name, text, path.join(root, file)).map((message) => message.messageId)
}
const suggest = (...names: unknown[]) => ({ pluginSuggestionMarketplaces: names })
const declare = (market: string) => ({
  extraKnownMarketplaces: { [market]: { source: { source: 'github', repo: 'a/b' } } },
})
const strictEntry = { strictKnownMarketplaces: [{ source: 'github', repo: 'acme/*' }] }

describe(`${name} (silent)`, () => {
  it('is silent for a name with an extraKnownMarketplaces entry in the file', () => {
    expect(idsAt({}, { ...suggest('acme'), ...declare('acme') })).toEqual([])
    expect(idsAt({}, { ...suggest('acme'), ...declare('acme') }, `${DROP}/10-a.json`)).toEqual([])
  })

  it('is silent for the alias additionalMarketplaces', () => {
    const alias = { additionalMarketplaces: declare('acme').extraKnownMarketplaces }
    expect(idsAt({}, { ...suggest('acme'), ...alias })).toEqual([])
  })

  it('is silent for any strictKnownMarketplaces entry, and for the alias', () => {
    expect(idsAt({}, { ...suggest('acme'), ...strictEntry })).toEqual([])
    const alias = { allowedMarketplaces: strictEntry.strictKnownMarketplaces }
    expect(idsAt({}, { ...suggest('acme'), ...alias })).toEqual([])
  })

  it('is silent for the official marketplace', () => {
    expect(idsAt({}, suggest('claude-plugins-official'))).toEqual([])
  })

  it('is silent when a sibling drop-in declares the name', () => {
    const files = { [`${DROP}/20-b.json`]: json(declare('acme')) }
    expect(idsAt(files, suggest('acme'))).toEqual([])
    const strictFiles = { [`${DROP}/20-b.json`]: json(strictEntry) }
    expect(idsAt(strictFiles, suggest('acme'))).toEqual([])
  })

  it('is silent when managed-settings.json declares the name, and the file is a drop-in', () => {
    expect(idsAt({ [MAIN]: json(declare('acme')) }, suggest('acme'), `${DROP}/10-a.json`)).toEqual(
      [],
    )
  })

  it('is silent when another drop-in declares the name, and the file is a drop-in', () => {
    const files = { [`${DROP}/20-b.json`]: json(strictEntry) }
    expect(idsAt(files, suggest('acme'), `${DROP}/10-a.json`)).toEqual([])
  })

  it('is silent when the source sets managedSourcesBehavior merge', () => {
    expect(idsAt({}, { ...suggest('acme'), managedSourcesBehavior: 'merge' })).toEqual([])
    const files = { [`${DROP}/20-b.json`]: json({ managedSourcesBehavior: 'merge' }) }
    expect(idsAt(files, suggest('acme'))).toEqual([])
    expect(
      idsAt(
        { [MAIN]: json({ managedSourcesBehavior: 'merge' }) },
        suggest('acme'),
        `${DROP}/10-a.json`,
      ),
    ).toEqual([])
  })

  it('is silent when a sibling does not parse to an object', () => {
    for (const text of ['[1]', 'null', '1', '"x"', '{']) {
      expect(idsAt({ [`${DROP}/20-b.json`]: text }, suggest('acme'))).toEqual([])
      expect(idsAt({ [MAIN]: text }, suggest('acme'), `${DROP}/10-a.json`)).toEqual([])
    }
  })

  it('is silent when a sibling is a dangling link', () => {
    const root = repo({})
    mkdirSync(path.join(root, DROP))
    symlinkSync(path.join(root, 'gone.json'), path.join(root, DROP, '20-b.json'))
    expect(lintJson(name, json(suggest('acme')), path.join(root, MAIN))).toEqual([])
  })

  it('is silent when a sibling cannot be read', { skip: chmodCannotBlock }, () => {
    const root = repo({ [`${DROP}/20-b.json`]: '{}' })
    withoutAccess(path.join(root, DROP, '20-b.json'), () => {
      expect(lintJson(name, json(suggest('acme')), path.join(root, MAIN))).toEqual([])
    })
  })

  it('is silent when the drop-in directory cannot be read', {
    skip: chmodCannotBlock,
  }, () => {
    const root = repo({ [`${DROP}/20-b.json`]: '{}' })
    withoutAccess(path.join(root, DROP), () => {
      expect(lintJson(name, json(suggest('acme')), path.join(root, MAIN))).toEqual([])
    })
  })

  it('is silent for a file with no pluginSuggestionMarketplaces', () => {
    expect(idsAt({}, { model: 'x' })).toEqual([])
    expect(idsAt({}, '[1]')).toEqual([])
  })

  it('is silent for a value that is not an array of strings', () => {
    expect(idsAt({}, { pluginSuggestionMarketplaces: 'acme' })).toEqual([])
    expect(idsAt({}, { pluginSuggestionMarketplaces: null })).toEqual([])
    expect(idsAt({}, suggest(1, null, ['acme'], { a: 1 }))).toEqual([])
  })

  it('is silent for a hidden drop-in', () => {
    expect(idsAt({}, suggest('acme'), `${DROP}/.10-a.json`)).toEqual([])
  })
})

describe(`${name} (reports)`, () => {
  it('reports a name with no source', () => {
    expect(idsAt({}, suggest('acme'))).toEqual(['undeclared'])
    expect(idsAt({}, suggest('acme'), `${DROP}/10-a.json`)).toEqual(['undeclared'])
  })

  it('reports at the name', () => {
    const root = repo({})
    const text = '{\n  "pluginSuggestionMarketplaces": ["claude-plugins-official", "acme"]\n}'
    const [message] = lintJson(name, text, path.join(root, MAIN))
    expect([message?.line, message?.column]).toEqual([2, 63])
  })

  it('reports each name with no source, and not the declared name', () => {
    const code = { ...suggest('acme', 'other', 'acme'), ...declare('acme') }
    expect(idsAt({}, code)).toEqual(['undeclared'])
    expect(idsAt({}, suggest('a', 'b'))).toEqual(['undeclared', 'undeclared'])
  })

  it('reports a name when the entry has another name', () => {
    expect(idsAt({}, { ...suggest('acme'), ...declare('other') })).toEqual(['undeclared'])
  })

  it('reports a name when the strictKnownMarketplaces list is empty', () => {
    expect(idsAt({}, { ...suggest('acme'), strictKnownMarketplaces: [] })).toEqual(['undeclared'])
  })

  it('reports a name when the declaring key is null or not an object', () => {
    expect(idsAt({}, { ...suggest('acme'), extraKnownMarketplaces: null })).toEqual(['undeclared'])
    expect(idsAt({}, { ...suggest('acme'), extraKnownMarketplaces: ['acme'] })).toEqual([
      'undeclared',
    ])
    expect(idsAt({}, { ...suggest('acme'), strictKnownMarketplaces: 'x' })).toEqual(['undeclared'])
  })

  it('reads the canonical key and not the alias when a file sets both', () => {
    const both = {
      ...suggest('acme'),
      extraKnownMarketplaces: {},
      additionalMarketplaces: declare('acme').extraKnownMarketplaces,
    }
    expect(idsAt({}, both)).toEqual(['undeclared'])
  })

  it('reports when managedSourcesBehavior is another value', () => {
    expect(idsAt({}, { ...suggest('acme'), managedSourcesBehavior: 'first-wins' })).toEqual([
      'undeclared',
    ])
  })

  it('does not count a hidden drop-in, or a file that does not end in .json', () => {
    const files = {
      [`${DROP}/.20-b.json`]: json(declare('acme')),
      [`${DROP}/30-c.txt`]: json(declare('acme')),
      [`${DROP}/sub/40-d.json`]: json(declare('acme')),
      [`${DROP}/50-e.json`]: json({ managedSourcesBehavior: 'merge' }).replace(
        'merge',
        'first-wins',
      ),
    }
    expect(idsAt(files, suggest('acme'))).toEqual(['undeclared'])
    const hiddenMerge = { [`${DROP}/.20-b.json`]: json({ managedSourcesBehavior: 'merge' }) }
    expect(idsAt(hiddenMerge, suggest('acme'))).toEqual(['undeclared'])
  })

  it('reads the file text and not the copy on the disk', () => {
    const files = { [MAIN]: json({ ...suggest('acme'), ...declare('acme') }) }
    expect(idsAt(files, suggest('acme'))).toEqual(['undeclared'])
  })

  it('reads the last of two keys of one name', () => {
    const text = '{"pluginSuggestionMarketplaces": ["a"], "pluginSuggestionMarketplaces": ["b"]}'
    expect(idsAt({}, text)).toEqual(['undeclared'])
  })
})
