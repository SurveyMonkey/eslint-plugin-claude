// When a plugin has a `settings.json` at its root that sets a supported key, Claude Code applies it
// and ignores the `settings` key of the manifest (components page, "Default settings"). The trees
// are on disk, because the rule reads the file beside the manifest. The files glob is in
// tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPlugin, pluginTree } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-settings-single-source'
const check = it.fails
const linked = noLinks ? it.skip : check

const message = (keys: string) =>
  `The plugin has a \`settings.json\` that sets ${keys}. Claude Code then ignores the \`settings\` key of the manifest. Keep the settings in one place.`
const manifestOf = (settings: unknown) => ({ name: 'p', settings })
const run = (settings: unknown, files: Record<string, string>) => {
  const { dir, code } = pluginTree(manifestOf(settings), files)
  return lintPlugin(RULE, dir, code).map((m) => m.message)
}

describe(RULE, () => {
  check('reports the settings key of the manifest, with the full message', () => {
    const { dir, code } = pluginTree(manifestOf({ agent: 'a' }), {
      'settings.json': '{"agent": "b"}',
    })
    const found = lintPlugin(RULE, dir, code)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'ignored',
      message: message('`agent`'),
      line: 1,
      column: 13,
      endColumn: 37,
    })
  })

  check.each([
    ['agent in both', { agent: 'a' }, { agent: 'b' }, '`agent`'],
    [
      'subagentStatusLine in both',
      { subagentStatusLine: {} },
      { subagentStatusLine: {} },
      '`subagentStatusLine`',
    ],
    [
      'another supported key in the file',
      { agent: 'a' },
      { subagentStatusLine: {} },
      '`subagentStatusLine`',
    ],
    [
      'both keys in the file',
      { agent: 'a' },
      { subagentStatusLine: {}, agent: 'b' },
      '`agent`, `subagentStatusLine`',
    ],
    ['a key of the file that is null', { agent: 'a' }, { agent: null }, '`agent`'],
    [
      'an unsupported key beside a supported one',
      { agent: 'a' },
      { model: 'x', agent: 'b' },
      '`agent`',
    ],
  ])('reports %s', (_title, manifest, file, keys) => {
    expect(run(manifest, { 'settings.json': JSON.stringify(file) })).toEqual([message(keys)])
  })

  check('reports a manifest settings that also holds an unsupported key', () => {
    expect(run({ model: 'x', agent: 'a' }, { 'settings.json': '{"agent": "b"}' })).toEqual([
      message('`agent`'),
    ])
  })

  check('reports in a plugin below the repository root', () => {
    const { dir, code } = pluginTree(
      manifestOf({ agent: 'a' }),
      { 'settings.json': '{"agent": "b"}' },
      'plugins/p/',
    )
    expect(lintPlugin(RULE, dir, code).map((m) => m.messageId)).toEqual(['ignored'])
  })

  linked('reports a settings.json that is a link to a file in the repository', () => {
    const { dir, code, top } = pluginTree(manifestOf({ agent: 'a' }), {
      'real.json': '{"agent": "b"}',
    })
    link(top, 'settings.json', 'real.json')
    expect(lintPlugin(RULE, dir, code).map((m) => m.messageId)).toEqual(['ignored'])
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['no manifest settings', undefined, '{"agent": "b"}'],
    ['a manifest settings that is a string', 'agent', '{"agent": "b"}'],
    ['a manifest settings that is an array', ['agent'], '{"agent": "b"}'],
    ['a manifest settings with no supported key', { model: 'x' }, '{"agent": "b"}'],
    ['a manifest settings that is empty', {}, '{"agent": "b"}'],
    ['a settings.json with no supported key', { agent: 'a' }, '{"model": "x"}'],
    ['an empty settings.json object', { agent: 'a' }, '{}'],
    ['a settings.json that does not parse', { agent: 'a' }, '{'],
    ['a settings.json that is an array', { agent: 'a' }, '["agent"]'],
    ['a settings.json that is null', { agent: 'a' }, 'null'],
    ['a key of the prototype', { agent: 'a' }, '{"constructor": 1}'],
  ])('stays silent for %s', (_title, manifest, file) => {
    expect(run(manifest, { 'settings.json': file })).toEqual([])
  })

  check('stays silent for a manifest settings and no settings.json', () => {
    expect(run({ agent: 'a' }, {})).toEqual([])
  })

  check('stays silent for a settings.json in a subfolder', () => {
    expect(run({ agent: 'a' }, { 'sub/settings.json': '{"agent": "b"}' })).toEqual([])
  })

  check('stays silent for a manifest that does not parse', () => {
    const { dir } = pluginTree('{', { 'settings.json': '{"agent": "b"}' })
    expect(lintPlugin(RULE, dir, '{')).toEqual([])
  })

  linked('stays silent for a settings.json that is a link with no target', () => {
    const { dir, code, top } = pluginTree(manifestOf({ agent: 'a' }))
    link(top, 'settings.json', 'ghost')
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  linked('stays silent for a settings.json that is a link out of the repository', () => {
    const elsewhere = tree({ 'settings.json': '{"agent": "b"}' })
    const { dir, code, top } = pluginTree(manifestOf({ agent: 'a' }))
    link(top, 'settings.json', path.join(elsewhere, 'settings.json'))
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })
})
