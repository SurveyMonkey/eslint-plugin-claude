// The rule reads the text of the linted file only. It lints an entry of `marketplace.json`, and
// a `url` source in a project settings file. The files glob and the decoy files are in
// tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import {
  lintMarketplace,
  lintSettings,
  marketplaceOf,
  tree,
} from '../marketplace-tree.test-support.ts'

const RULE = 'marketplace-headers-literal-credential'
const dir = tree({})
const SECRET = 'sk-live-4f9a7c'
const entry = (headers: unknown) =>
  marketplaceOf([
    { name: 'p', source: { source: 'archive', url: 'https://x.test/p.zip' }, headers },
  ])
const inEntry = (headers: unknown) => lintMarketplace(RULE, dir, entry(headers))
const urlSource = (extra: Record<string, unknown>) =>
  JSON.stringify({
    extraKnownMarketplaces: {
      acme: { source: { source: 'url', url: 'https://x.test/m.json', ...extra } },
    },
  })
const inSettings = (extra: Record<string, unknown>, file = '.claude/settings.json') =>
  lintSettings(RULE, dir, file, urlSource(extra))

describe(RULE, () => {
  it('reports a literal bearer token in an entry, on the value', () => {
    const code = `{
  "name": "acme",
  "plugins": [
    {
      "name": "p",
      "source": { "source": "archive", "url": "https://x.test/p.zip" },
      "headers": { "Authorization": "Bearer ${SECRET}" }
    }
  ]
}`
    const messages = lintMarketplace(RULE, dir, code)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'literal',
      line: 7,
      column: 37,
      endColumn: 60,
    })
  })

  it('names the header, and does not echo the value', () => {
    for (const messages of [
      inEntry({ Authorization: `Bearer ${SECRET}` }),
      inSettings({ headers: { 'X-Api-Key': SECRET } }),
    ]) {
      expect(messages).toHaveLength(1)
      expect(messages[0]?.message).not.toContain(SECRET)
      expect(messages[0]?.message).toMatch(/header "(?:Authorization|X-Api-Key)"/)
    }
  })

  it.each([
    ['Authorization', 'Bearer abc123'],
    ['authorization', 'bearer abc123'],
    ['Proxy-Authorization', 'Basic dXNlcjpwYXNz'],
    ['Authorization', 'abc123'],
    ['X-Api-Key', 'abc123'],
    ['X-Auth-Token', 'abc123'],
    ['X-Client-Secret', 'abc123'],
    ['X-Password', 'abc123'],
    ['X-Credentials', 'abc123'],
    ['X-Custom', 'Bearer abc123'],
    ['X-Access-Token', 'abc123'],
    ['X-Custom', 'Basic abc123'],
    ['X-Custom', 'Token abc123'],
    ['X-Custom', 'Digest abc123'],
    ['Authorization', `Bearer abc\${NOT_CLOSED`],
  ])('reports the header %s with the value %s', (header, value) => {
    expect(inEntry({ [header]: value }).map((m) => m.messageId)).toEqual(['literal'])
    expect(inSettings({ headers: { [header]: value } }).map((m) => m.messageId)).toEqual([
      'literal',
    ])
  })

  it('reports each literal header, and no header without a credential', () => {
    const messages = inEntry({
      Accept: 'application/json',
      Authorization: `Bearer ${SECRET}`,
      'X-Api-Key': SECRET,
      Authorization2: `\${TOKEN}`,
    })
    expect(messages.map((m) => m.messageId)).toEqual(['literal', 'literal'])
  })

  it('reports each entry that has a literal header', () => {
    const code = marketplaceOf([
      { name: 'a', headers: { Authorization: 'Bearer abc' } },
      { name: 'b', headers: { Authorization: `Bearer \${TOKEN}` } },
      { name: 'c', headers: { 'X-Api-Key': 'abc' } },
    ])
    expect(lintMarketplace(RULE, dir, code)).toHaveLength(2)
  })

  it('reports the last of two members with one name, as JSON.parse does', () => {
    const code = `{"plugins": [{"headers": {"Authorization": "\${T}", "Authorization": "Bearer abc"}}]}`
    expect(lintMarketplace(RULE, dir, code)).toHaveLength(1)
    const reverse = `{"plugins": [{"headers": {"Authorization": "Bearer abc", "Authorization": "\${T}"}}]}`
    expect(lintMarketplace(RULE, dir, reverse)).toEqual([])
    const twice =
      '{"plugins": [{"headers": {"A": "x"}, "headers": {"Authorization": "Bearer abc"}}]}'
    expect(lintMarketplace(RULE, dir, twice)).toHaveLength(1)
  })

  it.each(['.claude/settings.json', '.claude/settings.local.json'])(
    'reports the headers of a url source in %s',
    (file) => {
      const messages = inSettings({ headers: { Authorization: `Bearer ${SECRET}` } }, file)
      expect(messages).toHaveLength(1)
      expect(messages[0]).toMatchObject({ messageId: 'literal', line: 1 })
    },
  )

  it('reports in settings the last of two members with one name', () => {
    const code = `{"extraKnownMarketplaces": {"a": {"source": {"source": "url", "headers": {"Authorization": "\${T}"}}}, "a": {"source": {"source": "url", "headers": {"Authorization": "Bearer abc"}}}}}`
    expect(lintSettings(RULE, dir, '.claude/settings.json', code)).toHaveLength(1)
    const swapped = `{"extraKnownMarketplaces": {"a": {"source": {"source": "url", "headers": {"Authorization": "Bearer abc"}}}, "a": {"source": {"source": "url", "headers": {"Authorization": "\${T}"}}}}}`
    expect(lintSettings(RULE, dir, '.claude/settings.json', swapped)).toEqual([])
  })
})

describe(`${RULE} (silent)`, () => {
  it.each([
    [`a \${VAR} reference`, `Bearer \${TOKEN}`],
    [`a bare \${VAR} reference`, `\${TOKEN}`],
    ['a reference inside a value', `prefix-\${TOKEN}-suffix`],
    ['an empty value', ''],
    ['a blank value', '   '],
    ['a scheme word with no token', 'Bearer'],
    ['a scheme word and a space', 'Bearer '],
  ])('stays silent for %s in an Authorization header', (_title, value) => {
    expect(inEntry({ Authorization: value })).toEqual([])
    expect(inSettings({ headers: { Authorization: value } })).toEqual([])
  })

  it.each([
    ['Accept', 'application/json'],
    ['User-Agent', 'acme/1.0'],
    ['X-Request-Id', 'abc123'],
    ['X-Custom', 'abc123'],
    ['X-Custom', 'Bearerabc'],
  ])('stays silent for the header %s with the value %s', (header, value) => {
    expect(inEntry({ [header]: value })).toEqual([])
    expect(inSettings({ headers: { [header]: value } })).toEqual([])
  })

  it('stays silent for a value that is not a string', () => {
    expect(inEntry({ Authorization: 3, 'X-Api-Key': null, 'X-Token': ['abc'] })).toEqual([])
  })

  it('stays silent for entries without headers, and for headers that are not an object', () => {
    expect(
      lintMarketplace(RULE, dir, marketplaceOf([{ name: 'p', source: './p' }, 'x', null])),
    ).toEqual([])
    expect(inEntry('Bearer abc')).toEqual([])
    expect(inEntry(['Authorization'])).toEqual([])
    expect(inEntry(null)).toEqual([])
    expect(lintMarketplace(RULE, dir, '{"name": "acme"}')).toEqual([])
    expect(inSettings({ headers: 'Bearer abc' })).toEqual([])
    expect(inSettings({})).toEqual([])
  })

  it('stays silent for a source that is not a url source', () => {
    const settings = (source: unknown) =>
      lintSettings(
        RULE,
        dir,
        '.claude/settings.json',
        JSON.stringify({ extraKnownMarketplaces: { acme: { source } } }),
      )
    const headers = { Authorization: 'Bearer abc' }
    expect(settings({ source: 'git', url: 'https://x.test/m.git', headers })).toEqual([])
    expect(settings({ source: 'github', repo: 'a/b', headers })).toEqual([])
    expect(settings({ headers })).toEqual([])
    expect(settings({ source: 3, headers })).toEqual([])
    expect(settings('url')).toEqual([])
    expect(settings(null)).toEqual([])
  })

  it('stays silent when extraKnownMarketplaces is missing or is not an object', () => {
    const run = (text: string) => lintSettings(RULE, dir, '.claude/settings.json', text)
    expect(run('{}')).toEqual([])
    expect(run('{"extraKnownMarketplaces": []}')).toEqual([])
    expect(run('{"extraKnownMarketplaces": {"acme": 3}}')).toEqual([])
  })
})
