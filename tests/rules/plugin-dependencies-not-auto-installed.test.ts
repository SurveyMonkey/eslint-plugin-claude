// Claude Code never installs a dependency with a `command` source, and never runs the
// `headersHelper` of a dependency, so users install such a dependency first (dependencies page,
// "Constrain a dependency that has a non-git source"). The trees are on disk, because the rule
// reads the marketplace around the plugin. The files glob is in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, marketplaceOf, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPlugin } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-dependencies-not-auto-installed'
const check = it
const linked = noLinks ? it.skip : check

const command = (name: string) =>
  `The dependency "${name}" has a command source in its marketplace entry. Claude Code never installs it, so users install it first.`
const helper = (name: string) =>
  `The marketplace entry of the dependency "${name}" sets a "headersHelper". Claude Code never runs it for a dependency, so users install the dependency before they install this plugin.`

const COMMAND = { source: 'command', command: 'mint-plugin' }
const entries = [
  { name: 'p', source: './plugins/p' },
  { name: 'minted', source: COMMAND },
  {
    name: 'fetched',
    source: { source: 'archive', url: 'https://example.com/a.zip' },
    headersHelper: '/opt/bin/token.sh',
  },
  { name: 'local', source: './plugins/local' },
  { name: 'cloned', source: { source: 'github', repo: 'acme/cloned' } },
  { name: 'both', source: COMMAND, headersHelper: '/opt/bin/token.sh' },
]
function setup(dependencies: unknown, plugins: unknown[] = entries, extra = {}) {
  const code = JSON.stringify({ name: 'p', dependencies })
  const top = tree({
    '.claude-plugin/marketplace.json': marketplaceOf(plugins, extra),
    'plugins/p/.claude-plugin/plugin.json': code,
  })
  return { code, dir: path.join(top, 'plugins', 'p'), top }
}
const run = (dependencies: unknown, plugins: unknown[] = entries, extra = {}) => {
  const { dir, code } = setup(dependencies, plugins, extra)
  return lintPlugin(RULE, dir, code).map((m) => m.message)
}

describe(RULE, () => {
  check('reports a dependency with a command source, with the full message and position', () => {
    const { dir, code } = setup(['minted'])
    const found = lintPlugin(RULE, dir, code)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'command',
      message: command('minted'),
      line: 1,
      column: 29,
      endLine: 1,
      endColumn: 37,
    })
  })

  check.each([
    ['a bare string', ['minted']],
    ['an object with a name', [{ name: 'minted' }]],
    ['an object with a version', [{ name: 'minted', version: '^1.0' }]],
    ['a name with the own marketplace', ['minted@acme']],
    ['an object with the own marketplace', [{ name: 'minted', marketplace: 'acme' }]],
  ])('reports %s', (_title, dependencies) => {
    expect(run(dependencies)).toEqual([command('minted')])
  })

  check('reports a dependency whose entry sets a headersHelper', () => {
    const { dir, code } = setup(['fetched'])
    const found = lintPlugin(RULE, dir, code)
    expect(found.map((m) => m.message)).toEqual([helper('fetched')])
    expect(found[0]).toMatchObject({ messageId: 'headersHelper', line: 1, column: 29 })
  })

  check('reports both faults of one dependency, command first', () => {
    expect(run(['both'])).toEqual([command('both'), helper('both')])
  })

  check('reports each dependency in file order, and not the others', () => {
    expect(run(['local', 'fetched', 'cloned', 'minted'])).toEqual([
      helper('fetched'),
      command('minted'),
    ])
  })

  check('reports a dependency of a plugin below a marketplace in a parent folder', () => {
    const code = JSON.stringify({ name: 'p', dependencies: ['minted'] })
    const top = tree({
      'site/.claude-plugin/marketplace.json': marketplaceOf(entries),
      'site/deep/p/.claude-plugin/plugin.json': code,
    })
    const dir = path.join(top, 'site', 'deep', 'p')
    expect(lintPlugin(RULE, dir, code).map((m) => m.message)).toEqual([command('minted')])
  })

  check('reads the entry of the nearest marketplace', () => {
    const code = JSON.stringify({ name: 'p', dependencies: ['minted'] })
    const top = tree({
      '.claude-plugin/marketplace.json': marketplaceOf(entries),
      'inner/.claude-plugin/marketplace.json': marketplaceOf([
        { name: 'p', source: './p' },
        { name: 'minted', source: './minted' },
      ]),
      'inner/p/.claude-plugin/plugin.json': code,
    })
    expect(lintPlugin(RULE, path.join(top, 'inner', 'p'), code)).toEqual([])
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['a relative path source', ['local']],
    ['a github source', ['cloned']],
    ['a dependency that no entry names', ['ghost']],
    ['a dependency from another marketplace', ['minted@shared']],
    ['an object with another marketplace', [{ name: 'minted', marketplace: 'shared' }]],
    ['no dependencies', []],
    ['a dependencies value that is not an array', 'minted'],
    ['a dependencies value that is an object', { name: 'minted' }],
    ['an entry that is a number', [5]],
    ['an entry that is null', [null]],
    ['an entry that is an array', [['minted']]],
    ['an object with no name', [{ version: '^1.0' }]],
    ['an object with a name that is not a string', [{ name: 5 }]],
    ['an object with a marketplace that is not a string', [{ name: 'minted', marketplace: 5 }]],
  ])('stays silent for %s', (_title, dependencies) => {
    expect(run(dependencies)).toEqual([])
  })

  check.each([
    ['git-subdir', { source: 'git-subdir', url: 'https://example.com/r.git', path: 'p' }],
    ['url', { source: 'url', url: 'https://example.com/r.git' }],
    ['npm', { source: 'npm', package: '@acme/m' }],
    ['archive', { source: 'archive', url: 'https://example.com/a.zip' }],
    ['an unknown type', { source: 'cmd' }],
    ['a source with no type', { command: 'mint-plugin' }],
    ['a type that is not a string', { source: 3 }],
    ['a source that is a string', 'command'],
    ['a source that is null', null],
  ])('stays silent for a source of %s', (_title, source) => {
    expect(
      run(
        ['m'],
        [
          { name: 'p', source: './plugins/p' },
          { name: 'm', source },
        ],
      ),
    ).toEqual([])
  })

  check.each([
    ['empty', ''],
    ['a number', 3],
    ['null', null],
    ['an object', { command: 'x' }],
  ])('stays silent for a headersHelper that is %s', (_title, headersHelper) => {
    const plugins = [
      { name: 'p', source: './plugins/p' },
      { name: 'm', source: './m', headersHelper },
    ]
    expect(run(['m'], plugins)).toEqual([])
  })

  check('stays silent when two entries have the name of the dependency', () => {
    const twice = [...entries, { name: 'minted', source: './plugins/minted' }]
    expect(run(['minted'], twice)).toEqual([])
  })

  check('stays silent for a dependency that the allowlist of another marketplace names', () => {
    expect(
      run(['minted@shared'], entries, { allowCrossMarketplaceDependenciesOn: ['shared'] }),
    ).toEqual([])
  })

  check('stays silent for a plugin that no entry names', () => {
    expect(
      run(
        ['minted'],
        [
          { name: 'other', source: './plugins/other' },
          { name: 'minted', source: COMMAND },
        ],
      ),
    ).toEqual([])
  })

  check('stays silent for a plugin whose manifest has no string name', () => {
    const code = JSON.stringify({ dependencies: ['minted'] })
    const top = tree({
      '.claude-plugin/marketplace.json': marketplaceOf(entries),
      'plugins/p/.claude-plugin/plugin.json': code,
    })
    expect(lintPlugin(RULE, path.join(top, 'plugins', 'p'), code)).toEqual([])
  })

  check('stays silent when the marketplace plugins value is not an array', () => {
    const code = JSON.stringify({ name: 'p', dependencies: ['minted'] })
    for (const plugins of ['x', { a: 1 }, null]) {
      const top = tree({
        '.claude-plugin/marketplace.json': JSON.stringify({ name: 'acme', plugins }),
        'plugins/p/.claude-plugin/plugin.json': code,
      })
      expect(lintPlugin(RULE, path.join(top, 'plugins', 'p'), code)).toEqual([])
    }
  })

  check('ignores a marketplace entry that is not an object or has no string name', () => {
    expect(
      run(
        ['minted'],
        [
          5,
          null,
          { source: COMMAND },
          { name: 7, source: COMMAND },
          { name: 'p', source: './plugins/p' },
          { name: 'minted', source: COMMAND },
        ],
      ),
    ).toEqual([command('minted')])
  })

  check('reads a marketplace that has no name, for a bare dependency', () => {
    const code = JSON.stringify({ name: 'p', dependencies: ['minted', 'minted@acme'] })
    const top = tree({
      '.claude-plugin/marketplace.json': JSON.stringify({ owner: { name: 'o' }, plugins: entries }),
      'plugins/p/.claude-plugin/plugin.json': code,
    })
    expect(lintPlugin(RULE, path.join(top, 'plugins', 'p'), code).map((m) => m.message)).toEqual([
      command('minted'),
    ])
  })

  check('stays silent for a plugin in no marketplace', () => {
    const code = JSON.stringify({ name: 'p', dependencies: ['minted'] })
    const top = tree({ 'plugins/p/.claude-plugin/plugin.json': code })
    expect(lintPlugin(RULE, path.join(top, 'plugins', 'p'), code)).toEqual([])
  })

  check.each([
    ['a marketplace that does not parse', '{'],
    ['a marketplace that is an array', '[]'],
    ['a marketplace that is null', 'null'],
  ])('stays silent for %s', (_title, text) => {
    const code = JSON.stringify({ name: 'p', dependencies: ['minted'] })
    const top = tree({
      '.claude-plugin/marketplace.json': text,
      'plugins/p/.claude-plugin/plugin.json': code,
    })
    expect(lintPlugin(RULE, path.join(top, 'plugins', 'p'), code)).toEqual([])
  })

  check('stays silent for a manifest that does not parse', () => {
    const top = tree({
      '.claude-plugin/marketplace.json': marketplaceOf(entries),
      'plugins/p/.claude-plugin/plugin.json': '{',
    })
    const valid = JSON.stringify({ name: 'p', dependencies: ['minted'] })
    expect(lintPlugin(RULE, path.join(top, 'plugins', 'p'), valid)).toEqual([])
  })

  check('does not read the dependencies of a marketplace entry', () => {
    const plugins = [
      { name: 'p', source: './plugins/p', dependencies: ['minted'] },
      { name: 'minted', source: COMMAND },
    ]
    expect(run([], plugins)).toEqual([])
  })

  linked('stays silent when the marketplace.json is a link with no target', () => {
    const code = JSON.stringify({ name: 'p', dependencies: ['minted'] })
    const top = tree({ 'plugins/p/.claude-plugin/plugin.json': code })
    link(top, '.claude-plugin/marketplace.json', 'ghost')
    expect(lintPlugin(RULE, path.join(top, 'plugins', 'p'), code)).toEqual([])
  })

  linked('stays silent when the marketplace.json is a link out of the repository', () => {
    const elsewhere = tree({ 'marketplace.json': marketplaceOf(entries) }, false)
    const code = JSON.stringify({ name: 'p', dependencies: ['minted'] })
    const top = tree({ 'plugins/p/.claude-plugin/plugin.json': code })
    link(top, '.claude-plugin/marketplace.json', path.join(elsewhere, 'marketplace.json'))
    expect(lintPlugin(RULE, path.join(top, 'plugins', 'p'), code)).toEqual([])
  })
})
