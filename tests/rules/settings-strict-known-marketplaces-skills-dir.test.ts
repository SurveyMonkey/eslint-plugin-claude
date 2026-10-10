// An allowlist without a `skills-dir` entry stops skills-directory plugins. The managed settings
// page merges `managed-settings.json` and each `managed-settings.d/*.json` drop-in into one source
// and combines the lists. The rule reads the sibling files on disk.
import { mkdirSync, symlinkSync } from 'node:fs'
import path from 'node:path'
import jsonPlugin from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { repo } from '../agent-settings.test-support.ts'
import { chmodCannotBlock, lintJson, withoutAccess } from '../rule-tester.test-support.ts'

const name = 'settings-strict-known-marketplaces-skills-dir'
const MAIN = 'managed-settings.json'
const DROP = 'managed-settings.d'
const json = JSON.stringify

/** The message ids of the rule for the text `code` at `file` of a repository that holds `files`. */
function idsAt(files: Record<string, string>, code: unknown, file = MAIN) {
  const root = repo(files)
  const text = typeof code === 'string' ? code : json(code)
  return lintJson(name, text, path.join(root, file)).map((message) => message.messageId)
}
const github = { source: 'github', repo: 'acme/plugins' }
const skillsDir = { source: 'skills-dir' }
const allow = (...entries: unknown[]) => ({ strictKnownMarketplaces: entries })

describe(`${name} (silent)`, () => {
  it('is silent when the list has the skills-dir entry', () => {
    expect(idsAt({}, allow(github, skillsDir))).toEqual([])
    expect(idsAt({}, allow(skillsDir))).toEqual([])
    expect(idsAt({}, allow(skillsDir), `${DROP}/10-a.json`)).toEqual([])
  })

  it('is silent when the alias list has the skills-dir entry', () => {
    expect(idsAt({}, { allowedMarketplaces: [github, skillsDir] })).toEqual([])
  })

  it('is silent for a file with no allowlist', () => {
    expect(idsAt({}, { model: 'x' })).toEqual([])
    expect(idsAt({}, '[1]')).toEqual([])
    expect(idsAt({}, { blockedMarketplaces: [github] })).toEqual([])
  })

  it('is silent for a value that is not a list', () => {
    expect(idsAt({}, { strictKnownMarketplaces: 'x' })).toEqual([])
    expect(idsAt({}, { strictKnownMarketplaces: null })).toEqual([])
    expect(idsAt({}, { strictKnownMarketplaces: { source: 'skills-dir' } })).toEqual([])
  })

  it('is silent when a sibling drop-in has the entry, because the lists combine', () => {
    const files = { [`${DROP}/20-b.json`]: json(allow(skillsDir)) }
    expect(idsAt(files, allow(github))).toEqual([])
    expect(idsAt(files, allow(github), `${DROP}/10-a.json`)).toEqual([])
  })

  it('is silent when managed-settings.json has the entry, and the file is a drop-in', () => {
    expect(idsAt({ [MAIN]: json(allow(skillsDir)) }, allow(github), `${DROP}/10-a.json`)).toEqual(
      [],
    )
  })

  it('is silent when the alias of a sibling has the entry', () => {
    const files = { [`${DROP}/20-b.json`]: json({ allowedMarketplaces: [skillsDir] }) }
    expect(idsAt(files, allow(github))).toEqual([])
  })

  it('is silent when blockedMarketplaces has the entry, because the block is on purpose', () => {
    expect(idsAt({}, { ...allow(github), blockedMarketplaces: [skillsDir] })).toEqual([])
    const files = { [`${DROP}/20-b.json`]: json({ blockedMarketplaces: [skillsDir] }) }
    expect(idsAt(files, allow(github))).toEqual([])
  })

  it('is silent when the source sets managedSourcesBehavior merge', () => {
    expect(idsAt({}, { ...allow(github), managedSourcesBehavior: 'merge' })).toEqual([])
    const files = { [`${DROP}/20-b.json`]: json({ managedSourcesBehavior: 'merge' }) }
    expect(idsAt(files, allow(github))).toEqual([])
  })

  it('is silent when a sibling does not parse to an object', () => {
    for (const text of ['[1]', 'null', '1', '"x"', '{']) {
      expect(idsAt({ [`${DROP}/20-b.json`]: text }, allow(github))).toEqual([])
      expect(idsAt({ [MAIN]: text }, allow(github), `${DROP}/10-a.json`)).toEqual([])
    }
  })

  it('is silent when a sibling is a dangling link', () => {
    const root = repo({})
    mkdirSync(path.join(root, DROP))
    symlinkSync(path.join(root, 'gone.json'), path.join(root, DROP, '20-b.json'))
    expect(lintJson(name, json(allow(github)), path.join(root, MAIN))).toEqual([])
  })

  it('is silent when a sibling cannot be read', { skip: chmodCannotBlock }, () => {
    const root = repo({ [`${DROP}/20-b.json`]: '{}' })
    withoutAccess(path.join(root, DROP, '20-b.json'), () => {
      expect(lintJson(name, json(allow(github)), path.join(root, MAIN))).toEqual([])
    })
  })

  it('is silent when the drop-in directory cannot be read', { skip: chmodCannotBlock }, () => {
    const root = repo({ [`${DROP}/20-b.json`]: '{}' })
    withoutAccess(path.join(root, DROP), () => {
      expect(lintJson(name, json(allow(github)), path.join(root, MAIN))).toEqual([])
    })
  })

  it('is silent for text that JSON.parse rejects, such as a comment in a JSONC file', () => {
    const root = repo({})
    const messages = new Linter({ cwd: path.parse(root).root }).verify(
      '{\n  // comment\n  "strictKnownMarketplaces": []\n}',
      [
        {
          files: ['**/*.json'],
          plugins: { json: jsonPlugin, claude: plugin },
          language: 'json/jsonc',
          rules: { [`claude/${name}`]: 'error' },
        },
      ],
      { filename: path.join(root, MAIN) },
    )
    expect(messages).toEqual([])
  })

  it('is silent for a hidden drop-in', () => {
    expect(idsAt({}, allow(github), `${DROP}/.10-a.json`)).toEqual([])
  })
})

describe(`${name} (reports)`, () => {
  it('reports a list with no skills-dir entry, in the file and in a drop-in', () => {
    expect(idsAt({}, allow(github))).toEqual(['missing'])
    expect(idsAt({}, allow(github), `${DROP}/10-a.json`)).toEqual(['missing'])
  })

  it('reports an empty list, because any allowlist stops the plugins', () => {
    expect(idsAt({}, allow())).toEqual(['missing'])
  })

  it('reports an entry that only looks like the skills-dir entry', () => {
    expect(idsAt({}, allow('skills-dir', null, [skillsDir], { source: 'Skills-Dir' }))).toEqual([
      'missing',
    ])
    expect(idsAt({}, allow({ source: 'github', repo: 'skills-dir' }))).toEqual(['missing'])
  })

  it('reports on the key, and names the alias when the file uses it', () => {
    const root = repo({})
    const text = '{\n  "model": "x",\n  "allowedMarketplaces": []\n}'
    const [message] = lintJson(name, text, path.join(root, MAIN))
    expect([message?.line, message?.column, message?.message]).toEqual([
      3,
      3,
      expect.stringContaining('This "allowedMarketplaces" list'),
    ])
  })

  it('reads the canonical key and not the alias when a file sets both', () => {
    const both = { strictKnownMarketplaces: [github], allowedMarketplaces: [skillsDir] }
    expect(idsAt({}, both)).toEqual(['missing'])
  })

  it('reports when the sibling lists have no entry either', () => {
    const files = { [`${DROP}/20-b.json`]: json(allow(github)), [MAIN]: json(allow(github)) }
    expect(idsAt(files, allow(github), `${DROP}/10-a.json`)).toEqual(['missing'])
  })

  it('reads a null canonical key of a sibling as set, so its alias is ignored', () => {
    const sibling = { strictKnownMarketplaces: null, allowedMarketplaces: [skillsDir] }
    const files = { [`${DROP}/20-b.json`]: json(sibling) }
    expect(idsAt(files, allow(github))).toEqual(['missing'])
  })

  it('reports when managedSourcesBehavior is another value', () => {
    expect(idsAt({}, { ...allow(github), managedSourcesBehavior: 'first-wins' })).toEqual([
      'missing',
    ])
  })

  it('does not count a hidden drop-in, or a file that does not end in .json', () => {
    const files = {
      [`${DROP}/.20-b.json`]: json(allow(skillsDir)),
      [`${DROP}/30-c.txt`]: json(allow(skillsDir)),
      [`${DROP}/sub/40-d.json`]: json(allow(skillsDir)),
    }
    expect(idsAt(files, allow(github))).toEqual(['missing'])
    const hiddenMerge = { [`${DROP}/.20-b.json`]: json({ managedSourcesBehavior: 'merge' }) }
    expect(idsAt(hiddenMerge, allow(github))).toEqual(['missing'])
  })

  it('reads the file text and not the copy on the disk', () => {
    const files = { [MAIN]: json(allow(github, skillsDir)) }
    expect(idsAt(files, allow(github))).toEqual(['missing'])
  })

  it('reads the last of two keys of one name', () => {
    const text = `{"strictKnownMarketplaces": [${json(skillsDir)}], "strictKnownMarketplaces": []}`
    expect(idsAt({}, text)).toEqual(['missing'])
  })
})
