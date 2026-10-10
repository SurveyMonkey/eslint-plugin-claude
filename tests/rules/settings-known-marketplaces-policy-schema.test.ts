// The policy lists of a managed settings file: `strictKnownMarketplaces` (alias
// `allowedMarketplaces`) and `blockedMarketplaces` hold source objects, and
// `pluginTrustMessage` is a string. The settings reference, "Allowed source types", lists the
// fields. The marketplace reference, "Marketplace sources", lists `npm` and `settings`.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'settings-known-marketplaces-policy-schema'
const main = 'managed-settings.json'
const dropIn = 'etc/claude-code/managed-settings.d/10-a.json'
const hidden = 'managed-settings.d/.10-a.json'

/** The message ids of the rule for the managed settings text `value`. */
const ids = (value: unknown, filename = main) =>
  lintJson(name, JSON.stringify(value), filename).map((message) => message.messageId)
const strict = (...entries: unknown[]) => ({ strictKnownMarketplaces: entries })

describe(`${name} (silent)`, () => {
  const valid: [string, unknown][] = [
    ['github', strict({ source: 'github', repo: 'acme-corp/plugins', ref: 'main', path: 'm' })],
    [
      'git',
      strict({ source: 'git', url: 'https://gitlab.example.com/t/p.git', ref: 'production' }),
    ],
    ['url', strict({ source: 'url', url: 'https://p.example.com/m.json', headers: { A: 'b' } })],
    ['file', strict({ source: 'file', path: '/opt/acme-corp/plugins/marketplace.json' })],
    ['directory', strict({ source: 'directory', path: '/opt/acme-corp/approved' })],
    ['file with a Windows path', strict({ source: 'file', path: 'C:\\acme\\marketplace.json' })],
    ['hostPattern', strict({ source: 'hostPattern', hostPattern: '^github\\.example\\.com$' })],
    ['pathPattern', strict({ source: 'pathPattern', pathPattern: '^/opt/approved/' })],
    ['an empty pattern', strict({ source: 'pathPattern', pathPattern: '' })],
    ['skills-dir', strict({ source: 'skills-dir' })],
    ['settings', strict({ source: 'settings', name: 'x', plugins: [] })],
    ['an owner wildcard', strict({ source: 'github', repo: 'acme-corp/*' })],
    ['a field of another type', strict({ source: 'github', repo: 'a/b', skipLfs: true })],
    ['an empty list', strict()],
    ['blockedMarketplaces', { blockedMarketplaces: [{ source: 'github', repo: 'u/p' }] }],
    ['the alias', { allowedMarketplaces: [{ source: 'skills-dir' }] }],
    ['a list that is not an array', { strictKnownMarketplaces: 'x', blockedMarketplaces: {} }],
    ['a null list', { strictKnownMarketplaces: null }],
    [
      'the alias, when the canonical key is set',
      {
        strictKnownMarketplaces: [{ source: 'skills-dir' }],
        allowedMarketplaces: [{ source: 'npm' }],
      },
    ],
    ['no policy key', { model: 'x' }],
    ['a string pluginTrustMessage', { pluginTrustMessage: 'All plugins are approved by IT' }],
    ['a null pluginTrustMessage', { pluginTrustMessage: null }],
  ]
  for (const [title, value] of valid) {
    it.fails(`is silent for ${title}`, () => {
      expect(ids(value)).toEqual([])
      expect(ids(value, dropIn)).toEqual([])
    })
  }

  it.fails('is silent for a top level that is not an object', () => {
    expect(lintJson(name, '[1]', main)).toEqual([])
  })

  it.fails('is silent for a hidden drop-in', () => {
    expect(ids(strict({ source: 'bogus' }), hidden)).toEqual([])
    expect(ids({ pluginTrustMessage: 1 }, hidden)).toEqual([])
  })
})

describe(`${name} (reports)`, () => {
  const invalid: [string, unknown, string[]][] = [
    [
      'an entry that is not an object',
      strict('x', 1, null, ['github']),
      Array(4).fill('entryNotObject'),
    ],
    ['a missing source type', strict({ repo: 'a/b' }), ['typeMissing']],
    ['a source type that is not a string', strict({ source: 1 }), ['typeNotString']],
    ['an unknown source type', strict({ source: 'bogus' }), ['typeUnknown']],
    ['a source type in the wrong case', strict({ source: 'GitHub', repo: 'a/b' }), ['typeUnknown']],
    ['an npm entry', strict({ source: 'npm', package: 'x' }), ['typeNpm']],
    ['a missing repo', strict({ source: 'github' }), ['missingField']],
    ['a repo that is not a string', strict({ source: 'github', repo: 1 }), ['fieldType']],
    ['a missing url in a git entry', strict({ source: 'git' }), ['missingField']],
    ['a missing url in a url entry', strict({ source: 'url', headers: {} }), ['missingField']],
    [
      'headers that are not an object',
      strict({ source: 'url', url: 'u', headers: 'x' }),
      ['fieldType'],
    ],
    ['a ref that is not a string', strict({ source: 'git', url: 'u', ref: 1 }), ['fieldType']],
    ['a missing path in a file entry', strict({ source: 'file' }), ['missingField']],
    [
      'a relative file path',
      strict({ source: 'file', path: 'plugins/marketplace.json' }),
      ['pathRelative'],
    ],
    [
      'a relative directory path',
      strict({ source: 'directory', path: './plugins' }),
      ['pathRelative'],
    ],
    ['a home path', strict({ source: 'directory', path: '~/plugins' }), ['pathRelative']],
    ['a missing hostPattern', strict({ source: 'hostPattern' }), ['missingField']],
    [
      'a hostPattern that does not compile',
      strict({ source: 'hostPattern', hostPattern: '(' }),
      ['patternInvalid'],
    ],
    [
      'a pathPattern that does not compile',
      strict({ source: 'pathPattern', pathPattern: '[a-' }),
      ['patternInvalid'],
    ],
    [
      'a pathPattern that is not a string',
      strict({ source: 'pathPattern', pathPattern: [] }),
      ['fieldType'],
    ],
    [
      'a repo with a star in the name',
      strict({ source: 'github', repo: 'acme-corp/tools-*' }),
      ['repoWildcard'],
    ],
    [
      'a repo with a star as the owner',
      strict({ source: 'github', repo: '*/plugins' }),
      ['repoWildcard'],
    ],
    ['a lone star', strict({ source: 'github', repo: '*' }), ['repoWildcard']],
    [
      'a star in the owner and the name',
      strict({ source: 'github', repo: '*/*' }),
      ['repoWildcard'],
    ],
    ['an entry in blockedMarketplaces', { blockedMarketplaces: [{ source: 'npm' }] }, ['typeNpm']],
    ['an entry under the alias', { allowedMarketplaces: [{ source: 'bogus' }] }, ['typeUnknown']],
    ['a pluginTrustMessage that is not a string', { pluginTrustMessage: 5 }, ['trustMessageType']],
    ['a pluginTrustMessage that is an array', { pluginTrustMessage: ['x'] }, ['trustMessageType']],
    [
      'a fault in each list',
      {
        strictKnownMarketplaces: [{ source: 'file', path: 'a' }],
        blockedMarketplaces: [{ source: 'github', repo: '*' }],
        pluginTrustMessage: false,
      },
      ['pathRelative', 'repoWildcard', 'trustMessageType'],
    ],
    [
      'two faults in one entry',
      strict({ source: 'url', url: 1, headers: 1 }),
      ['fieldType', 'fieldType'],
    ],
  ]
  for (const [title, value, expected] of invalid) {
    it.fails(`reports ${title}`, () => {
      expect(ids(value)).toEqual(expected)
      expect(ids(value, dropIn)).toEqual(expected)
    })
  }

  it.fails('reads the last of two keys of one name', () => {
    const text = '{"strictKnownMarketplaces": [{"source": "bogus"}], "strictKnownMarketplaces": []}'
    expect(lintJson(name, text, main)).toEqual([])
    const bad = '{"strictKnownMarketplaces": [], "strictKnownMarketplaces": [{"source": "bogus"}]}'
    expect(lintJson(name, bad, main).map((m) => m.messageId)).toEqual(['typeUnknown'])
  })

  it.fails('reports at the node of the fault', () => {
    const text =
      '{\n  "strictKnownMarketplaces": [\n    { "source": "file", "path": "rel" }\n  ]\n}'
    const [message] = lintJson(name, text, main)
    expect([message?.line, message?.column]).toEqual([3, 33])
  })
})
