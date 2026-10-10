// The walk lists the links in name order, whatever order the file system
// gives. `readdirSync` is the one boundary that this test needs: the file
// system of the test machine may already list names in order. The mock gives
// each list in reverse name order.
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { escapingLinks } from '../src/plugin-links.ts'
import { readPluginAt } from '../src/plugin-manifest.ts'
import { link, manifestOf, marketplaceOf, noLinks, tree } from './marketplace-tree.test-support.ts'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  const readdirSync = (...args: unknown[]) => {
    const found = (actual.readdirSync as (...rest: unknown[]) => { name: string }[])(...args)
    return [...found].sort((a, b) => (a.name < b.name ? 1 : -1))
  }
  return { ...actual, default: { ...actual, readdirSync }, readdirSync }
})

const linked = noLinks ? it.skip : it

describe('escapingLinks order', () => {
  linked('lists the links in name order when the file system does not', () => {
    const top = tree({
      '.claude-plugin/marketplace.json': marketplaceOf([{ name: 'p', source: './plugins/p' }]),
      'plugins/p/.claude-plugin/plugin.json': manifestOf({ name: 'p' }),
      'plugins/q/x.md': '',
    })
    const dir = path.join(top, 'plugins/p')
    link(dir, 'c-link', '../q')
    link(dir, 'a-link', '../q')
    link(dir, 'b/b-link', '../../q')
    const plugin = readPluginAt(dir)
    expect(plugin && escapingLinks(plugin).map((l) => l.file)).toEqual([
      'a-link',
      'b/b-link',
      'c-link',
    ])
  })
})
