// The rule reads the `plugin.json` beside the `marketplace.json`. The tree is on disk, because
// the rule reads it. The files glob and the decoy files are in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  link,
  lintMarketplace,
  manifestOf,
  marketplaceOf,
  noLinks,
  tree,
} from '../marketplace-tree.test-support.ts'

const RULE = 'marketplace-self-hosted-root-source'
const lint = (dir: string, code: string) => lintMarketplace(RULE, dir, code)
const manifest = (git = true) =>
  tree({ '.claude-plugin/plugin.json': manifestOf({ name: 'deploy-helper' }) }, git)
const withSource = (source: unknown) => marketplaceOf([{ name: 'deploy-helper', source }])

describe(RULE, () => {
  it('reports a marketplace beside a plugin.json with no entry for the root', () => {
    const code = `{
  "name": "acme",
  "plugins": [
    { "name": "deploy-helper", "source": "./plugins/deploy-helper" }
  ]
}`
    const messages = lint(manifest(), code)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'noRootEntry',
      line: 3,
      column: 14,
      endLine: 5,
      endColumn: 4,
    })
  })

  it('reports an empty plugins array', () => {
    expect(lint(manifest(), marketplaceOf([])).map((m) => m.messageId)).toEqual(['noRootEntry'])
  })

  it('reports an entry with an object source, and a name equal to the manifest name', () => {
    const source = { source: 'github', repo: 'acme/deploy-helper' }
    expect(lint(manifest(), withSource(source))).toHaveLength(1)
  })

  it.each([
    ['a subdirectory', './plugins/p'],
    ['a parent', '..'],
    ['a parent with ./', './..'],
    ['a backslash', '.\\'],
    ['a path that returns to the root with ..', 'plugins/..'],
    ['a path that returns to the root with ./ and ..', './plugins/..'],
    ['an empty string', ''],
    ['a source that is not a string', 3],
    ['a bare name', 'p'],
  ])('does not take %s for the root', (_title, source) => {
    expect(lint(manifest(), withSource(source))).toHaveLength(1)
  })

  it('reports in a tree with no .git', () => {
    expect(lint(manifest(false), withSource('./plugins/p'))).toHaveLength(1)
  })

  it('reads the last of two source keys, as JSON.parse does', () => {
    const code = '{"plugins": [{"name": "p", "source": ".", "source": "./plugins/p"}]}'
    expect(lint(manifest(), code)).toHaveLength(1)
    const root = '{"plugins": [{"name": "p", "source": "./plugins/p", "source": "."}]}'
    expect(lint(manifest(), root)).toEqual([])
  })
})

describe(`${RULE} (silent)`, () => {
  it.each([
    ['"./"', './'],
    ['"."', '.'],
    ['"./."', './.'],
    ['"././"', '././'],
    ['"./" with a second slash', './/'],
  ])('stays silent for an entry with the source %s', (_title, source) => {
    expect(lint(manifest(), withSource(source))).toEqual([])
  })

  it('stays silent when one entry of several has the root source', () => {
    const code = marketplaceOf([
      { name: 'a', source: './plugins/a' },
      'text',
      { name: 'deploy-helper', source: './' },
    ])
    expect(lint(manifest(), code)).toEqual([])
  })

  it('stays silent for a root entry whose name differs, which the name rule reports', () => {
    const code = marketplaceOf([{ name: 'other', source: './' }])
    expect(lint(manifest(), code)).toEqual([])
  })

  it('stays silent when no plugin.json sits beside the marketplace', () => {
    expect(lint(tree({}), withSource('./plugins/p'))).toEqual([])
    expect(lint(tree({ '.claude-plugin/other.json': '{}' }), withSource('./plugins/p'))).toEqual([])
  })

  it.each([
    ['does not parse', '{'],
    ['is an array', '[]'],
    ['is null', 'null'],
  ])('stays silent when the plugin.json %s', (_title, text) => {
    const dir = tree({ '.claude-plugin/plugin.json': text })
    expect(lint(dir, withSource('./plugins/p'))).toEqual([])
  })

  it('stays silent when plugins is missing or is not an array', () => {
    expect(lint(manifest(), '{"name": "acme"}')).toEqual([])
    expect(lint(manifest(), JSON.stringify({ plugins: { name: 'p' } }))).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a plugin.json that is a dangling link', () => {
    const dir = tree({})
    link(dir, '.claude-plugin/plugin.json', 'gone.json')
    expect(lint(dir, withSource('./plugins/p'))).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a plugin.json link out of the repository', () => {
    const outside = tree({ 'plugin.json': manifestOf({ name: 'deploy-helper' }) })
    const dir = tree({})
    link(dir, '.claude-plugin/plugin.json', path.join(outside, 'plugin.json'))
    expect(lint(dir, withSource('./plugins/p'))).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a .claude-plugin directory out of the repository', () => {
    const outside = tree({ 'plugin.json': manifestOf({ name: 'deploy-helper' }) })
    const dir = tree({})
    link(dir, '.claude-plugin', outside)
    expect(lint(dir, withSource('./plugins/p'))).toEqual([])
  })
})
