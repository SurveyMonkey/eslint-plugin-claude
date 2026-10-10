// A link under a plugin whose target is out of the marketplace is skipped when
// Claude Code copies the plugin (host a marketplace, "Share files within a
// marketplace with symlinks"). The marketplace root is the folder of the
// nearest `.claude-plugin/marketplace.json` above the plugin, and the plugin
// root when there is none. The trees are on disk, because the rule walks the
// plugin. The files glob is in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, manifestOf, marketplaceOf, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPlugin } from '../plugin-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'plugin-symlink-escapes-marketplace'
const check = it.fails
const linked = noLinks ? it.skip : check
const locked = chmodCannotBlock ? it.skip : check
const MANIFEST = manifestOf({ name: 'p' })
const CATALOG = marketplaceOf([{ name: 'p', source: './plugins/p' }])
const message = (file: string, target: string) =>
  `The link "${file}" leads to "${target}", out of the marketplace. Claude Code skips it when it copies the plugin, so the target is missing from the installed copy. Keep the target inside the marketplace.`

/** A repository with the marketplace in `site` and the plugin `site/plugins/p`. `out` and
 *  `site/shared` are files and folders for links. The result is the repository. */
function repo(files: Record<string, string> = {}) {
  return tree({
    'site/.claude-plugin/marketplace.json': CATALOG,
    'site/plugins/p/.claude-plugin/plugin.json': MANIFEST,
    'site/plugins/p/own.md': '# Own\n',
    'site/plugins/q/skills/s/SKILL.md': '# S\n',
    'site/shared/s.md': '# S\n',
    'out/o.md': '# O\n',
    ...files,
  })
}
const lint = (dir: string) => lintPlugin(RULE, dir, MANIFEST)
const dirOf = (top: string) => path.join(top, 'site', 'plugins', 'p')

describe(RULE, () => {
  linked('reports a link to a file out of the marketplace, on the document', () => {
    const top = repo()
    link(dirOf(top), 'skills/o.md', '../../../../out/o.md')
    const found = lint(dirOf(top))
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'escapes',
      message: message('skills/o.md', 'out/o.md'),
      line: 1,
      column: 1,
    })
  })

  linked('reports a link to a folder out of the marketplace', () => {
    const top = repo()
    link(dirOf(top), 'skills', '../../../out')
    expect(lint(dirOf(top)).map((m) => m.message)).toEqual([message('skills', 'out')])
  })

  linked('reports each link, in name order, at any depth', () => {
    const top = repo()
    link(dirOf(top), 'z.md', '../../../out/o.md')
    link(dirOf(top), 'a/b/c.md', '../../../../../out/o.md')
    link(dirOf(top), 'a.md', '../../../out/o.md')
    expect(lint(dirOf(top)).map((m) => m.message)).toEqual([
      message('a.md', 'out/o.md'),
      message('a/b/c.md', 'out/o.md'),
      message('z.md', 'out/o.md'),
    ])
  })

  linked('reports each link of a chain on its own', () => {
    const top = repo()
    link(dirOf(top), 'first', 'second')
    link(dirOf(top), 'second', '../../../out/o.md')
    expect(lint(dirOf(top)).map((m) => m.message)).toEqual([
      message('first', 'out/o.md'),
      message('second', 'out/o.md'),
    ])
  })

  linked('names the repository root with a dot', () => {
    const top = repo()
    link(dirOf(top), 'root', '../../..')
    expect(lint(dirOf(top)).map((m) => m.message)).toEqual([message('root', '.')])
  })

  linked('uses the plugin root as the bound when no marketplace.json is above', () => {
    const top = tree({
      'plugins/p/.claude-plugin/plugin.json': MANIFEST,
      'plugins/q/x.md': '',
      'shared/s.md': '',
    })
    const dir = path.join(top, 'plugins', 'p')
    link(dir, 'sibling', '../q')
    link(dir, 'own', '.claude-plugin')
    expect(lint(dir).map((m) => m.message)).toEqual([message('sibling', 'plugins/q')])
  })

  linked('uses the plugin root when the plugin holds the marketplace.json', () => {
    const top = tree({
      '.claude-plugin/marketplace.json': CATALOG,
      'plugins/p/.claude-plugin/marketplace.json': CATALOG,
      'plugins/p/.claude-plugin/plugin.json': MANIFEST,
      'plugins/q/x.md': '',
    })
    const dir = path.join(top, 'plugins', 'p')
    link(dir, 'sibling', '../q')
    expect(lint(dir).map((m) => m.message)).toEqual([message('sibling', 'plugins/q')])
  })

  linked('uses the nearest marketplace.json', () => {
    const top = repo({ 'site/plugins/.claude-plugin/marketplace.json': CATALOG })
    // The plugin `q` is in the nearer marketplace, so only `shared` leaves it.
    link(dirOf(top), 'sibling', '../q')
    link(dirOf(top), 'shared', '../../shared')
    expect(lint(dirOf(top)).map((m) => m.message)).toEqual([message('shared', 'site/shared')])
  })
})

describe(`${RULE} (silent)`, () => {
  linked('stays silent for a link to a place in the plugin', () => {
    const top = repo()
    link(dirOf(top), 'alias.md', 'own.md')
    link(dirOf(top), 'meta', '.claude-plugin')
    link(dirOf(top), 'deep/up', '..')
    expect(lint(dirOf(top))).toEqual([])
  })

  linked('stays silent for a link to another place in the marketplace', () => {
    const top = repo()
    link(dirOf(top), 'skills/s', '../../q/skills/s')
    link(dirOf(top), 'shared', '../../shared')
    expect(lint(dirOf(top))).toEqual([])
  })

  check('stays silent for a plugin with no link', () => {
    expect(lint(dirOf(repo()))).toEqual([])
  })

  linked('stays silent for a link with no target, and for a loop', () => {
    const top = repo()
    link(dirOf(top), 'dead', 'gone')
    link(dirOf(top), 'loop', 'loop')
    link(dirOf(top), 'dead-dir/x', 'gone/deeper')
    expect(lint(dirOf(top))).toEqual([])
  })

  linked('stays silent for a link out of the repository', () => {
    const outside = tree({ 'o.md': '' }, false)
    const top = repo()
    link(dirOf(top), 'far.md', path.join(outside, 'o.md'))
    link(dirOf(top), 'far', outside)
    expect(lint(dirOf(top))).toEqual([])
  })

  linked('stays silent in a tree with no .git, where the plugin is the repository', () => {
    const top = tree(
      { 'plugins/p/.claude-plugin/plugin.json': MANIFEST, 'plugins/q/x.md': '' },
      false,
    )
    const dir = path.join(top, 'plugins', 'p')
    link(dir, 'sibling', '../q')
    expect(lint(dir)).toEqual([])
  })

  linked('does not enter a link to a folder, or a node_modules or .git folder', () => {
    const top = repo({
      'site/plugins/p/node_modules/m/index.js': '',
      'site/plugins/p/vendor/.git/HEAD': '',
    })
    link(top, 'site/plugins/q/up', '../../../out')
    link(dirOf(top), 'q', '../q')
    link(dirOf(top), 'node_modules/m/out', '../../../../../out')
    link(dirOf(top), 'vendor/.git/out', '../../../../../out')
    expect(lint(dirOf(top))).toEqual([])
  })

  linked('stays silent when a marketplace.json above the plugin cannot be read', () => {
    const top = repo()
    link(dirOf(top), 'far.md', '../../../out/o.md')
    link(top, 'site/plugins/.claude-plugin/marketplace.json', 'gone.json')
    expect(lint(dirOf(top))).toEqual([])
  })

  check('ignores a marketplace.json above the repository', () => {
    const outer = tree(
      {
        '.claude-plugin/marketplace.json': CATALOG,
        'repo/.git/HEAD': '',
        'repo/plugins/p/.claude-plugin/plugin.json': MANIFEST,
        'repo/plugins/q/x.md': '',
      },
      false,
    )
    const dir = path.join(outer, 'repo', 'plugins', 'p')
    link(dir, 'sibling', '../q')
    expect(lint(dir).map((m) => m.message)).toEqual([message('sibling', 'plugins/q')])
  })

  locked('stays silent for a folder that it cannot list, and keeps the other links', () => {
    const top = repo()
    link(dirOf(top), 'closed/far', '../../../../out/o.md')
    link(dirOf(top), 'open/far', '../../../../out/o.md')
    withoutAccess(path.join(dirOf(top), 'closed'), () => {
      expect(lint(dirOf(top)).map((m) => m.message)).toEqual([message('open/far', 'out/o.md')])
    })
  })

  check('stays silent for a plugin that the rule cannot see', () => {
    const top = repo({ 'site/plugins/p/.claude-plugin/plugin.json': '[]' })
    link(dirOf(top), 'far.md', '../../../out/o.md')
    expect(lintPlugin(RULE, dirOf(top), '[]')).toEqual([])
  })
})
