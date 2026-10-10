// The reader of the commands that a shell runs in the files of a plugin. The
// rules of the plugin layer test the commands. This file tests which file is
// which: the role of each path, and the plugin that it gives.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { pluginFileOf } from '../src/plugin-commands.ts'
import { tree } from './marketplace-tree.test-support.ts'
import { pluginTree } from './plugin-tree.test-support.ts'

describe('pluginFileOf', () => {
  it.each([
    ['.claude-plugin/plugin.json', 'manifest'],
    ['hooks/hooks.json', 'hooks'],
    ['.mcp.json', 'mcp'],
    ['monitors/monitors.json', 'monitors'],
  ])('gives the role and the plugin of %s', (file, role) => {
    const { dir } = pluginTree({ name: 'p' })
    const found = pluginFileOf(path.join(dir, file))
    expect(found?.role).toBe(role)
    expect(found?.plugin.root).toBe(dir)
    expect(found?.plugin.fields).toEqual({ name: 'p' })
  })

  it.each([
    'plugin.json',
    'hooks.json',
    'monitors.json',
    '.claude-plugin/hooks.json',
    'hooks/monitors.json',
    'hooks/hooks.json/x.json',
    'sub/.mcp.json',
    'sub/hooks/hooks.json',
  ])('gives nothing for %s', (file) => {
    const { dir } = pluginTree({ name: 'p' })
    expect(pluginFileOf(path.join(dir, file))).toBeUndefined()
  })

  it('gives nothing for a file in no plugin', () => {
    expect(pluginFileOf(path.join(tree({}), '.mcp.json'))).toBeUndefined()
  })
})
