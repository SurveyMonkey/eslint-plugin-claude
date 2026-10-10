// A link under a plugin whose target is out of the plugin and in the same
// marketplace is copied by a marketplace install, and skipped by a local-path
// install and by a `command` source in copy mode (host a marketplace, "Share
// files within a marketplace with symlinks"). The marketplace root is the
// folder of the nearest `.claude-plugin/marketplace.json` above the plugin.
// With none, the plugin is its own marketplace, so no link leaves the plugin
// and stays in the marketplace. The trees are on disk, because the rule walks
// the plugin. The files glob is in tests/configs.test.ts.
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { link, manifestOf, marketplaceOf, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPlugin } from '../plugin-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'plugin-symlink-escapes-plugin'
const check = it.fails
const linked = noLinks ? it.skip : check
const locked = chmodCannotBlock ? it.skip : check
const MANIFEST = manifestOf({ name: 'p' })
const CATALOG = marketplaceOf([{ name: 'p', source: './plugins/p' }])
const message = (file: string, target: string) =>
  `The link "${file}" leads to "${target}", out of the plugin and inside the marketplace. A marketplace install copies the target. A local-path install and a command source in copy mode skip the link. Keep the target inside the plugin, so that each install keeps it.`

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
  linked('reports a link to a folder of another plugin, on the document', () => {
    const top = repo()
    link(dirOf(top), 'skills/s', '../../q/skills/s')
    const found = lint(dirOf(top))
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'leaves',
      message: message('skills/s', 'site/plugins/q/skills/s'),
      line: 1,
      column: 1,
    })
  })

  linked('reports a link to a file in the marketplace, and a link to the marketplace root', () => {
    const top = repo()
    link(dirOf(top), 'shared.md', '../../shared/s.md')
    link(dirOf(top), 'root', '../..')
    expect(lint(dirOf(top)).map((m) => m.message)).toEqual([
      message('root', 'site'),
      message('shared.md', 'site/shared/s.md'),
    ])
  })

  linked('reports each link, depth first in name order', () => {
    const top = repo()
    link(dirOf(top), 'z.md', '../../shared/s.md')
    link(dirOf(top), 'a/b/c.md', '../../../../shared/s.md')
    link(dirOf(top), 'a.md', '../../shared/s.md')
    expect(lint(dirOf(top)).map((m) => m.message)).toEqual([
      message('a/b/c.md', 'site/shared/s.md'),
      message('a.md', 'site/shared/s.md'),
      message('z.md', 'site/shared/s.md'),
    ])
  })

  linked('reports each link of a chain on its own', () => {
    const top = repo()
    link(dirOf(top), 'first', 'second')
    link(dirOf(top), 'second', '../../shared/s.md')
    expect(lint(dirOf(top)).map((m) => m.message)).toEqual([
      message('first', 'site/shared/s.md'),
      message('second', 'site/shared/s.md'),
    ])
  })

  linked('uses the nearest marketplace.json as the bound', () => {
    const top = repo({ 'site/plugins/.claude-plugin/marketplace.json': CATALOG })
    // The plugin `q` is in the nearer marketplace, and `shared` is not.
    link(dirOf(top), 'sibling', '../q')
    link(dirOf(top), 'shared', '../../shared')
    expect(lint(dirOf(top)).map((m) => m.message)).toEqual([message('sibling', 'site/plugins/q')])
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

  linked('stays silent for a link out of the marketplace, which the marketplace rule owns', () => {
    const top = repo()
    link(dirOf(top), 'far.md', '../../../out/o.md')
    expect(lint(dirOf(top))).toEqual([])
  })

  check('stays silent for a plugin with no link', () => {
    expect(lint(dirOf(repo()))).toEqual([])
  })

  linked('stays silent when no marketplace.json is above, because the plugin is the bound', () => {
    const top = tree({ 'plugins/p/.claude-plugin/plugin.json': MANIFEST, 'plugins/q/x.md': '' })
    const dir = path.join(top, 'plugins', 'p')
    link(dir, 'sibling', '../q')
    expect(lint(dir)).toEqual([])
  })

  linked('stays silent when the plugin holds the marketplace.json', () => {
    const top = tree({
      '.claude-plugin/marketplace.json': CATALOG,
      'plugins/p/.claude-plugin/marketplace.json': CATALOG,
      'plugins/p/.claude-plugin/plugin.json': MANIFEST,
      'plugins/q/x.md': '',
    })
    const dir = path.join(top, 'plugins', 'p')
    link(dir, 'sibling', '../q')
    expect(lint(dir)).toEqual([])
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
      {
        '.claude-plugin/marketplace.json': CATALOG,
        'plugins/p/.claude-plugin/plugin.json': MANIFEST,
        'plugins/q/x.md': '',
      },
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
    link(top, 'site/plugins/q/up', '../../shared')
    link(dirOf(top), 'plugin-q', '../q')
    link(dirOf(top), 'node_modules/m/out', '../../../../shared')
    link(dirOf(top), 'vendor/.git/out', '../../../../shared')
    expect(lint(dirOf(top)).map((m) => m.message)).toEqual([message('plugin-q', 'site/plugins/q')])
  })

  linked('stays silent when a marketplace.json above the plugin cannot be read', () => {
    const top = repo()
    link(dirOf(top), 'sibling', '../q')
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
    expect(lint(dir)).toEqual([])
  })

  locked('stays silent for a folder that it cannot list, and keeps the other links', () => {
    const top = repo()
    link(dirOf(top), 'closed/s', '../../../q/skills/s')
    link(dirOf(top), 'open/s', '../../../q/skills/s')
    withoutAccess(path.join(dirOf(top), 'closed'), () => {
      expect(lint(dirOf(top)).map((m) => m.message)).toEqual([
        message('open/s', 'site/plugins/q/skills/s'),
      ])
    })
  })

  check('stays silent for a plugin that the rule cannot see', () => {
    const top = repo({ 'site/plugins/p/.claude-plugin/plugin.json': '[]' })
    link(dirOf(top), 'sibling', '../q')
    expect(lintPlugin(RULE, dirOf(top), '[]')).toEqual([])
  })
})

describe(`${RULE} with the marketplace rule`, () => {
  linked('gives one report for each link, from one of the two rules', () => {
    const top = repo()
    link(dirOf(top), 'in-plugin', 'own.md')
    link(dirOf(top), 'in-marketplace', '../../shared/s.md')
    link(dirOf(top), 'out-of-marketplace', '../../../out/o.md')
    const found = new Linter({ cwd: path.parse(top).root }).verify(
      MANIFEST,
      [
        {
          files: ['**/.claude-plugin/plugin.json'],
          plugins: { json, claude: plugin },
          language: 'json/json',
          rules: {
            'claude/plugin-symlink-escapes-marketplace': 'error',
            [`claude/${RULE}`]: 'error',
          },
        },
      ],
      { filename: path.join(dirOf(top), '.claude-plugin', 'plugin.json') },
    )
    expect(found.map((m) => [m.ruleId, m.message.split('"')[1]])).toEqual([
      ['claude/plugin-symlink-escapes-marketplace', 'out-of-marketplace'],
      [`claude/${RULE}`, 'in-marketplace'],
    ])
  })
})
