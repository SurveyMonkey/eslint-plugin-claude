// Where a link leads, for a plugin and for its marketplace. The trees are on
// disk, because the helper reads real paths. The rules that use the helper
// have their own tests, and so does the entry path rule.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { escapingLinks, placeOf } from '../src/plugin-links.ts'
import { type Plugin, readPluginAt } from '../src/plugin-manifest.ts'
import { link, manifestOf, marketplaceOf, noLinks, tree } from './marketplace-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from './rule-tester.test-support.ts'

const linked = noLinks ? it.skip : it
const locked = chmodCannotBlock ? it.skip : it
const MANIFEST = manifestOf({ name: 'p' })
const CATALOG = marketplaceOf([{ name: 'p', source: './plugins/p' }])

/** A repository with the plugin `plugins/p` and the marketplace catalog at its top. */
function repo(files: Record<string, string> = {}, git = true) {
  return tree(
    {
      '.claude-plugin/marketplace.json': CATALOG,
      'plugins/p/.claude-plugin/plugin.json': MANIFEST,
      'plugins/p/own.md': '# Own\n',
      'plugins/q/skills/s/SKILL.md': '# S\n',
      'shared/s.md': '# S\n',
      ...files,
    },
    git,
  )
}

function pluginAt(dir: string): Plugin {
  const found = readPluginAt(dir)
  if (found === undefined) {
    throw new Error(`No plugin at ${dir}.`)
  }
  return found
}

describe('placeOf', () => {
  const at = (top: string, target: string) => {
    const plugin = pluginAt(path.join(top, 'plugins', 'p'))
    const scopes = { marketplace: top, plugin: plugin.realRoot }
    return placeOf(plugin.realRoot, plugin.realRoot, plugin.bound, scopes, target)
  }

  linked('gives plugin for a target in the plugin, marketplace for one in the marketplace', () => {
    const top = repo()
    link(top, 'plugins/p/in', 'own.md')
    link(top, 'plugins/p/sibling', '../q/skills/s')
    const own = path.join(top, 'plugins/p/own.md')
    expect(at(top, path.join(top, 'plugins/p/in'))).toEqual({ reach: 'plugin', real: own })
    expect(at(top, own)).toEqual({ reach: 'plugin', real: own })
    expect(at(top, path.join(top, 'plugins/p/sibling'))).toEqual({
      reach: 'marketplace',
      real: path.join(top, 'plugins/q/skills/s'),
    })
  })

  linked('gives outside for a target in the repository and out of the marketplace', () => {
    const top = repo({ 'site/plugins/p/.claude-plugin/plugin.json': MANIFEST })
    const dir = path.join(top, 'site/plugins/p')
    link(dir, 'far', '../../../shared')
    const plugin = pluginAt(dir)
    const scopes = { marketplace: path.join(top, 'site'), plugin: plugin.realRoot }
    expect(
      placeOf(plugin.realRoot, plugin.realRoot, plugin.bound, scopes, path.join(dir, 'far')),
    ).toEqual({ reach: 'outside', real: path.join(top, 'shared') })
  })

  it('gives missing for a path that is not there', () => {
    const top = repo()
    expect(at(top, path.join(top, 'plugins/p/nope/deeper'))).toEqual({ reach: 'missing' })
  })

  linked('gives unreadable for a link with no target and for a link out of the repository', () => {
    const top = repo()
    link(top, 'plugins/p/dead', 'gone')
    link(top, 'plugins/p/far', path.dirname(top))
    expect(at(top, path.join(top, 'plugins/p/dead'))).toEqual({ reach: 'unreadable' })
    expect(at(top, path.join(top, 'plugins/p/far'))).toEqual({ reach: 'unreadable' })
  })
})

describe('the marketplace root of a plugin', () => {
  /** The reach of a link from `plugins/p` to the sibling plugin `plugins/q`, or undefined when
   *  `escapingLinks` lists no link. */
  const reachOfSibling = (top: string, plugin = 'plugins/p') => {
    const dir = path.join(top, plugin)
    link(dir, 'sibling', path.relative(dir, path.join(top, 'plugins/q')))
    return escapingLinks(pluginAt(dir))[0]?.reach
  }

  linked('is the folder of the catalog above the plugin', () => {
    expect(reachOfSibling(repo())).toBe('marketplace')
  })

  linked('is the nearest folder when two hold a catalog', () => {
    const top = repo({ 'plugins/.claude-plugin/marketplace.json': CATALOG })
    link(path.join(top, 'plugins/p'), 'shared', '../../shared')
    expect(escapingLinks(pluginAt(path.join(top, 'plugins/p')))[0]?.reach).toBe('outside')
  })

  linked('is the plugin root when the plugin holds the catalog', () => {
    const top = repo({ 'plugins/p/.claude-plugin/marketplace.json': CATALOG })
    expect(reachOfSibling(top)).toBe('outside')
  })

  linked('is the plugin root when no folder holds a catalog', () => {
    const top = tree({
      'plugins/p/.claude-plugin/plugin.json': MANIFEST,
      'plugins/q/x.md': '',
    })
    expect(reachOfSibling(top)).toBe('outside')
  })

  linked('is the folder of a catalog that does not parse', () => {
    expect(reachOfSibling(repo({ '.claude-plugin/marketplace.json': '{' }))).toBe('marketplace')
  })

  linked('does not reach above the repository root', () => {
    const outer = tree(
      {
        '.claude-plugin/marketplace.json': CATALOG,
        'repo/.git/HEAD': '',
        'repo/plugins/p/.claude-plugin/plugin.json': MANIFEST,
        'repo/plugins/q/x.md': '',
      },
      false,
    )
    expect(reachOfSibling(path.join(outer, 'repo'))).toBe('outside')
  })

  linked('does not reach above a plugin in a tree with no .git', () => {
    const outer = tree(
      {
        '.claude-plugin/marketplace.json': CATALOG,
        'plugins/p/.claude-plugin/plugin.json': MANIFEST,
        'plugins/q/x.md': '',
      },
      false,
    )
    // The sibling is out of the plugin, which is the bound, so the link has no result.
    expect(reachOfSibling(outer)).toBeUndefined()
  })

  linked('gives no link for a catalog that is a link with no target', () => {
    const top = repo()
    link(top, 'plugins/.claude-plugin/marketplace.json', 'gone.json')
    expect(reachOfSibling(top)).toBeUndefined()
  })

  linked('gives no link for a catalog that is a link out of the repository', () => {
    const outside = tree({ 'm.json': CATALOG }, false)
    const top = repo()
    link(top, 'plugins/.claude-plugin/marketplace.json', path.join(outside, 'm.json'))
    expect(reachOfSibling(top)).toBeUndefined()
  })
})

describe('escapingLinks', () => {
  linked('lists the links that leave the plugin, in name order, with the reach of each', () => {
    const top = tree({
      'site/.claude-plugin/marketplace.json': CATALOG,
      'site/plugins/p/.claude-plugin/plugin.json': MANIFEST,
      'site/shared/s.md': '',
      'out/o.md': '',
    })
    const dir = path.join(top, 'site/plugins/p')
    link(dir, 'z-far', '../../../out/o.md')
    link(dir, 'a-sibling', '../../shared')
    link(dir, 'sub/deeper/b-far', '../../../../../out')
    link(dir, 'inside', '.claude-plugin')
    expect(escapingLinks(pluginAt(dir))).toEqual([
      { file: 'a-sibling', reach: 'marketplace', target: 'site/shared' },
      { file: 'sub/deeper/b-far', reach: 'outside', target: 'out' },
      { file: 'z-far', reach: 'outside', target: 'out/o.md' },
    ])
  })

  linked('walks the real folder of a plugin that is reached through a link', () => {
    const top = tree({
      '.claude-plugin/marketplace.json': CATALOG,
      'plugins/.claude-plugin/marketplace.json': CATALOG,
      'packages/p/.claude-plugin/plugin.json': MANIFEST,
      'packages/p/own.md': '',
      'shared/s.md': '',
    })
    link(top, 'plugins/p', '../packages/p')
    const real = path.join(top, 'packages/p')
    link(real, 'shared-link', '../../shared')
    link(real, 'own-link', 'own.md')
    expect(escapingLinks(pluginAt(path.join(top, 'plugins/p')))).toEqual([
      { file: 'shared-link', reach: 'marketplace', target: 'shared' },
    ])
  })

  linked('gives marketplace for a link to another place in the marketplace', () => {
    const top = repo()
    const dir = path.join(top, 'plugins/p')
    link(dir, 'skills/s', '../../q/skills/s')
    link(dir, 'file.md', '../../shared/s.md')
    expect(escapingLinks(pluginAt(dir))).toEqual([
      { file: 'file.md', reach: 'marketplace', target: 'shared/s.md' },
      { file: 'skills/s', reach: 'marketplace', target: 'plugins/q/skills/s' },
    ])
  })

  linked('gives the links out of a plugin that is its own marketplace as outside', () => {
    const top = tree({
      'plugins/p/.claude-plugin/plugin.json': MANIFEST,
      'plugins/q/x.md': '',
    })
    const dir = path.join(top, 'plugins/p')
    link(dir, 'q', '../q')
    link(dir, 'own', 'x.md')
    expect(escapingLinks(pluginAt(dir)).map((l) => [l.file, l.reach])).toEqual([['q', 'outside']])
  })

  linked('names the repository root as a dot', () => {
    const top = tree({
      'site/.claude-plugin/marketplace.json': CATALOG,
      'site/plugins/p/.claude-plugin/plugin.json': MANIFEST,
    })
    const dir = path.join(top, 'site/plugins/p')
    link(dir, 'root', '../../..')
    expect(escapingLinks(pluginAt(dir))).toEqual([{ file: 'root', reach: 'outside', target: '.' }])
  })

  linked('skips a link with no target, a link out of the repository, and a loop', () => {
    const outside = tree({ 'o.md': '' }, false)
    const top = repo()
    const dir = path.join(top, 'plugins/p')
    link(dir, 'dead', 'gone')
    link(dir, 'far', path.join(outside, 'o.md'))
    link(dir, 'loop', 'loop')
    expect(escapingLinks(pluginAt(dir))).toEqual([])
  })

  linked('does not enter a link to a folder, or a .git or node_modules folder', () => {
    const top = repo({
      'plugins/p/node_modules/m/index.js': '',
      'plugins/p/vendor/.git/HEAD': '',
      'plugins/q/inner/x.md': '',
    })
    const dir = path.join(top, 'plugins/p')
    link(dir, 'node_modules/m/out', '../../../../shared')
    link(dir, 'vendor/.git/out', '../../../../shared')
    link(dir, 'q', '../q')
    link(top, 'plugins/q/up', '../../shared')
    link(dir, 'inner-dir', '.claude-plugin')
    expect(escapingLinks(pluginAt(dir)).map((l) => l.file)).toEqual(['q'])
  })

  linked('gives no link when the catalog cannot be read', () => {
    const top = repo()
    const dir = path.join(top, 'plugins/p')
    link(dir, 'sibling', '../q')
    link(top, 'plugins/.claude-plugin/marketplace.json', 'gone.json')
    expect(escapingLinks(pluginAt(dir))).toEqual([])
  })

  locked('skips a folder that it cannot list and keeps the other links', () => {
    const top = repo()
    const dir = path.join(top, 'plugins/p')
    link(dir, 'closed/sibling', '../../q')
    link(dir, 'open/sibling', '../../q')
    withoutAccess(path.join(dir, 'closed'), () => {
      expect(escapingLinks(pluginAt(dir)).map((l) => l.file)).toEqual(['open/sibling'])
    })
  })
})
