// A bare dependency name resolves in the marketplace of the plugin, and a dependency from another
// marketplace needs `allowCrossMarketplaceDependenciesOn` in the root marketplace (dependencies
// page, "Depend on a plugin from another marketplace"). The trees are on disk, because the rule
// reads the marketplace around the plugin. The files glob is in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, marketplaceOf, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPlugin } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-dependencies-resolve'
const check = it
const linked = noLinks ? it.skip : check

const missing = (name: string) =>
  `The dependency "${name}" is not in "plugins" of the marketplace "acme". Claude Code looks it up there, so it cannot install the dependency.`
const refused = (name: string, target: string) =>
  `The dependency "${name}" is in the marketplace "${target}". "allowCrossMarketplaceDependenciesOn" in the marketplace "acme" does not list it, so Claude Code does not install the dependency.`

const entries = [
  { name: 'p', source: './plugins/p' },
  { name: 'audit-logger', source: './plugins/audit-logger' },
  { name: 'secrets-vault', source: { source: 'npm', package: '@acme/secrets-vault' } },
]
/** The plugin `p` below a marketplace. `extra` sets members of `marketplace.json`. */
function setup(
  dependencies: unknown,
  extra: Record<string, unknown> = {},
  plugins: unknown[] = entries,
) {
  const code = JSON.stringify({ name: 'p', dependencies })
  const top = tree({
    '.claude-plugin/marketplace.json': marketplaceOf(plugins, extra),
    'plugins/p/.claude-plugin/plugin.json': code,
  })
  return { code, dir: path.join(top, 'plugins', 'p'), top }
}
const run = (
  dependencies: unknown,
  extra: Record<string, unknown> = {},
  plugins: unknown[] = entries,
) => {
  const { dir, code } = setup(dependencies, extra, plugins)
  return lintPlugin(RULE, dir, code).map((m) => m.message)
}

describe(`${RULE} (unlisted plugin)`, () => {
  check('stays silent for a plugin that no entry names', () => {
    expect(run(['ghost'], {}, [{ name: 'other', source: './plugins/other' }])).toEqual([])
  })

  check('stays silent for a plugin that an entry lists under another name', () => {
    expect(run(['ghost'], {}, [{ name: 'other', source: './plugins/p' }])).toEqual([])
  })

  check('stays silent for a plugin whose manifest has no string name', () => {
    const code = JSON.stringify({ dependencies: ['ghost'] })
    const top = tree({
      '.claude-plugin/marketplace.json': marketplaceOf(entries),
      'plugins/p/.claude-plugin/plugin.json': code,
    })
    expect(lintPlugin(RULE, path.join(top, 'plugins', 'p'), code)).toEqual([])
  })
})

describe(RULE, () => {
  check('reports a bare name that the marketplace does not list, with the full message', () => {
    const { dir, code } = setup(['ghost'])
    const found = lintPlugin(RULE, dir, code)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'missing',
      message: missing('ghost'),
      line: 1,
      column: 29,
      endColumn: 36,
    })
  })

  check.each([
    ['a bare string', ['ghost']],
    ['an object with a name', [{ name: 'ghost' }]],
    ['an object with a version', [{ name: 'ghost', version: '^1.0' }]],
    ['a name with the own marketplace', ['ghost@acme']],
    ['an object with the own marketplace', [{ name: 'ghost', marketplace: 'acme' }]],
  ])('reports %s', (_title, dependencies) => {
    expect(run(dependencies)).toEqual([missing('ghost')])
  })

  check('reports a string that starts with @ as one name, with no marketplace', () => {
    expect(run(['@ghost'])).toEqual([missing('@ghost')])
  })

  check('reports each dependency in file order, and not the ones that are listed', () => {
    expect(run(['b', 'audit-logger', { name: 'a' }, 'secrets-vault'])).toEqual([
      missing('b'),
      missing('a'),
    ])
  })

  check('reports a dependency from another marketplace when nothing allows it', () => {
    expect(run([{ name: 'audit-logger', marketplace: 'shared' }])).toEqual([
      refused('audit-logger', 'shared'),
    ])
    expect(run(['audit-logger@shared'])).toEqual([refused('audit-logger', 'shared')])
  })

  check.each([
    ['a list without the marketplace', ['other']],
    ['an empty list', []],
    ['a list with a value that is not a string', [5, null]],
  ])('reports a dependency from another marketplace with %s', (_title, allow) => {
    expect(run(['audit-logger@shared'], { allowCrossMarketplaceDependenciesOn: allow })).toEqual([
      refused('audit-logger', 'shared'),
    ])
  })

  check('reports a miss and a refusal in file order', () => {
    expect(run(['ghost@acme', 'audit-logger@shared'])).toEqual([
      missing('ghost'),
      refused('audit-logger', 'shared'),
    ])
  })

  check('reports a dependency of a plugin that sits at the repository root', () => {
    const code = JSON.stringify({ name: 'p', dependencies: ['ghost'] })
    const top = tree({
      '.claude-plugin/marketplace.json': marketplaceOf(entries),
      '.claude-plugin/plugin.json': code,
    })
    expect(lintPlugin(RULE, top, code).map((m) => m.message)).toEqual([missing('ghost')])
  })

  check('reports a dependency of a plugin below a marketplace that sits in a parent folder', () => {
    const code = JSON.stringify({ name: 'p', dependencies: ['ghost'] })
    const top = tree({
      'site/.claude-plugin/marketplace.json': marketplaceOf(entries),
      'site/deep/er/p/.claude-plugin/plugin.json': code,
    })
    const dir = path.join(top, 'site', 'deep', 'er', 'p')
    expect(lintPlugin(RULE, dir, code).map((m) => m.message)).toEqual([missing('ghost')])
  })

  check('reports against the nearest marketplace', () => {
    const code = JSON.stringify({ name: 'p', dependencies: ['audit-logger'] })
    const top = tree({
      '.claude-plugin/marketplace.json': marketplaceOf(entries),
      'inner/.claude-plugin/marketplace.json': marketplaceOf([{ name: 'p', source: './p' }]),
      'inner/p/.claude-plugin/plugin.json': code,
    })
    const dir = path.join(top, 'inner', 'p')
    expect(lintPlugin(RULE, dir, code).map((m) => m.message)).toEqual([missing('audit-logger')])
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['a bare name that is listed', ['audit-logger']],
    ['an object name that is listed', [{ name: 'audit-logger' }]],
    ['a name with the own marketplace that is listed', ['audit-logger@acme']],
    [
      'an object with the own marketplace that is listed',
      [{ name: 'audit-logger', marketplace: 'acme' }],
    ],
    [
      'a constrained dependency from the git source of a path',
      [{ name: 'audit-logger', version: '~1.0' }],
    ],
    ['no dependencies', []],
    ['a dependencies value that is not an array', 'ghost'],
    ['a dependencies value that is an object', { name: 'ghost' }],
    ['an entry that is a number', [5]],
    ['an entry that is null', [null]],
    ['an entry that is an array', [['ghost']]],
    ['an object with no name', [{ version: '^1.0' }]],
    ['an object with a name that is not a string', [{ name: 5 }]],
    ['an object with a marketplace that is not a string', [{ name: 'ghost', marketplace: 5 }]],
  ])('stays silent for %s', (_title, dependencies) => {
    expect(run(dependencies)).toEqual([])
  })

  check('stays silent for a dependency from a marketplace that the list names', () => {
    const allow = { allowCrossMarketplaceDependenciesOn: ['shared'] }
    expect(run(['audit-logger@shared', { name: 'ghost', marketplace: 'shared' }], allow)).toEqual(
      [],
    )
  })

  check(
    'stays silent for a constrained dependency with an npm source, which the rule cannot read',
    () => {
      expect(run([{ name: 'secrets-vault', version: '~2.1.0' }])).toEqual([])
    },
  )

  check(
    'stays silent for a dependency from another marketplace when the list is not an array',
    () => {
      for (const allow of ['shared', { shared: true }, null]) {
        expect(
          run(['audit-logger@shared'], { allowCrossMarketplaceDependenciesOn: allow }),
        ).toEqual([])
      }
    },
  )

  check('stays silent when the marketplace has no name, which the messages need', () => {
    const code = JSON.stringify({ name: 'p', dependencies: ['ghost', 'audit-logger@shared'] })
    const top = tree({
      '.claude-plugin/marketplace.json': JSON.stringify({ owner: { name: 'o' }, plugins: entries }),
      'plugins/p/.claude-plugin/plugin.json': code,
    })
    expect(lintPlugin(RULE, path.join(top, 'plugins', 'p'), code)).toEqual([])
  })

  check('stays silent when the marketplace plugins value is not an array', () => {
    const code = JSON.stringify({ name: 'p', dependencies: ['ghost'] })
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
      run(['ghost', 'audit-logger'], {}, [
        5,
        null,
        { source: './x' },
        { name: 7 },
        { name: 'audit-logger', source: './a' },
        { name: 'p', source: './plugins/p' },
      ]),
    ).toEqual([missing('ghost')])
  })

  check('stays silent for a plugin in no marketplace', () => {
    const code = JSON.stringify({ name: 'p', dependencies: ['ghost'] })
    const top = tree({ 'plugins/p/.claude-plugin/plugin.json': code })
    expect(lintPlugin(RULE, path.join(top, 'plugins', 'p'), code)).toEqual([])
  })

  check.each([
    ['a marketplace that does not parse', '{'],
    ['a marketplace that is an array', '[]'],
    ['a marketplace that is null', 'null'],
  ])('stays silent for %s', (_title, text) => {
    const code = JSON.stringify({ name: 'p', dependencies: ['ghost'] })
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
    const valid = JSON.stringify({ name: 'p', dependencies: ['ghost'] })
    expect(lintPlugin(RULE, path.join(top, 'plugins', 'p'), valid)).toEqual([])
  })

  linked('stays silent when the marketplace.json is a link with no target', () => {
    const code = JSON.stringify({ name: 'p', dependencies: ['ghost'] })
    const top = tree({ 'plugins/p/.claude-plugin/plugin.json': code })
    link(top, '.claude-plugin/marketplace.json', 'ghost')
    expect(lintPlugin(RULE, path.join(top, 'plugins', 'p'), code)).toEqual([])
  })

  linked('stays silent when the marketplace.json is a link out of the repository', () => {
    const elsewhere = tree({ 'marketplace.json': marketplaceOf(entries) }, false)
    const code = JSON.stringify({ name: 'p', dependencies: ['ghost'] })
    const top = tree({ 'plugins/p/.claude-plugin/plugin.json': code })
    link(top, '.claude-plugin/marketplace.json', path.join(elsewhere, 'marketplace.json'))
    expect(lintPlugin(RULE, path.join(top, 'plugins', 'p'), code)).toEqual([])
  })
})
