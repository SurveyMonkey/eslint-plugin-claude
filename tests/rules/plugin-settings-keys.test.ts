// A plugin sets default settings in a root `settings.json` or in the manifest key `settings`. Two
// keys take effect, `agent` and `subagentStatusLine`, and Claude Code drops every other key
// (components page, "Default settings"; manifest reference, "settings"). The trees are on disk,
// because the rule finds the plugin root. The files glob is in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPlugin, lintPluginFile, pluginTree } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-settings-keys'
const check = it
const linked = noLinks ? it.skip : check
const GLOBS = ['**/.claude-plugin/plugin.json', '**/settings.json']

const message = (key: string) =>
  `Claude Code drops \`${key}\` from the default settings of a plugin. Only \`agent\` and \`subagentStatusLine\` take effect.`

/** The messages for the manifest `code` of a plugin tree. */
const inManifest = (code: unknown, files: Record<string, string> = {}) => {
  const found = pluginTree(code, files)
  return lintPlugin(RULE, found.dir, found.code)
}
/** The messages for the root `settings.json` of a plugin tree. */
const inFile = (text: string, manifest: unknown = { name: 'p' }) => {
  const { dir } = pluginTree(manifest, { 'settings.json': text })
  return lintPluginFile(RULE, GLOBS, path.join(dir, 'settings.json'), text)
}
/** The key names in the data of each message. */
const keys = (found: ReturnType<typeof inFile>) =>
  found.map((m) => [m.messageId, m.message.split('`')[1]])

describe(RULE, () => {
  check('reports theme in a root settings.json once, on the key, with the full message', () => {
    const found = inFile('{"theme": "dark"}')
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'unsupported',
      message: message('theme'),
      line: 1,
      column: 2,
      endLine: 1,
      endColumn: 9,
    })
  })

  check('reports model and permissions in a root settings.json, one report on each key', () => {
    const found = inFile('{"model": "x", "permissions": {"allow": []}}')
    expect(keys(found)).toEqual([
      ['unsupported', 'model'],
      ['unsupported', 'permissions'],
    ])
  })

  check('reports model in the manifest settings, on the key', () => {
    const found = inManifest({ name: 'p', settings: { model: 'x' } })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      messageId: 'unsupported',
      message: message('model'),
      line: 1,
      column: 25,
      endColumn: 32,
    })
  })

  check('reports only the keys that are not supported, beside the two that are', () => {
    const settings = { agent: 'a', model: 'x', subagentStatusLine: {}, theme: 'dark' }
    expect(keys(inManifest({ name: 'p', settings }))).toEqual([
      ['unsupported', 'model'],
      ['unsupported', 'theme'],
    ])
    expect(keys(inFile(JSON.stringify(settings)))).toEqual([
      ['unsupported', 'model'],
      ['unsupported', 'theme'],
    ])
  })

  check('reports a repeated key once, on the last member, as JSON.parse keeps it', () => {
    const found = inFile('{"theme": "dark", "theme": "light"}')
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ messageId: 'unsupported', column: 19, endColumn: 26 })
  })

  check('reports a key with the name of a prototype key', () => {
    expect(keys(inFile('{"constructor": 1}'))).toEqual([['unsupported', 'constructor']])
  })

  check('reports a key that differs from a supported key in case', () => {
    expect(keys(inFile('{"Agent": "a"}'))).toEqual([['unsupported', 'Agent']])
  })

  check('reports in a plugin below the repository root', () => {
    const { dir, code } = pluginTree({ name: 'p', settings: { model: 'x' } }, {}, 'plugins/p/')
    expect(lintPlugin(RULE, dir, code).map((m) => m.messageId)).toEqual(['unsupported'])
  })

  check('reports the root settings.json of a plugin in .claude/skills/<name>', () => {
    const { dir } = pluginTree({ name: 'p' }, { 'settings.json': '{}' }, '.claude/skills/p/')
    const file = path.join(dir, 'settings.json')
    expect(lintPluginFile(RULE, GLOBS, file, '{"theme": "dark"}')).toHaveLength(1)
  })

  check('reports the manifest settings and the root settings.json of one plugin each', () => {
    const files = { 'settings.json': '{"agent": "a"}' }
    const found = inManifest({ name: 'p', settings: { agent: 'b', model: 'x' } }, files)
    expect(keys(found)).toEqual([['unsupported', 'model']])
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['agent', { agent: 'a' }],
    ['subagentStatusLine', { subagentStatusLine: { type: 'command', command: 'x' } }],
    ['both supported keys', { agent: 'a', subagentStatusLine: {} }],
    ['an empty object', {}],
  ])('stays silent for %s', (_title, settings) => {
    expect(inManifest({ name: 'p', settings })).toEqual([])
    expect(inFile(JSON.stringify(settings))).toEqual([])
  })

  // `claude plugin validate` 2.1.302 fails a manifest `settings` that is not an object
  // ("expected record").
  check.each([
    ['null', null],
    ['a string', 'theme'],
    ['an array', [{ theme: 'dark' }]],
    ['a number', 3],
  ])('stays silent for a manifest settings that is %s', (_title, settings) => {
    expect(inManifest({ name: 'p', settings })).toEqual([])
  })

  check.each([
    ['null', 'null'],
    ['a string', '"theme"'],
    ['an array', '[{"theme": "dark"}]'],
    ['a number', '3'],
  ])('stays silent for a root settings.json that is %s', (_title, text) => {
    expect(inFile(text)).toEqual([])
  })

  check('stays silent for a manifest with no settings key', () => {
    expect(inManifest({ name: 'p', model: 'x' })).toEqual([])
  })

  check('stays silent for a key in an object below a supported key', () => {
    expect(inFile('{"subagentStatusLine": {"theme": "dark"}}')).toEqual([])
  })

  check('stays silent for the settings.json of a project .claude folder', () => {
    const top = tree({ '.claude/settings.json': '{"theme": "dark"}' })
    const file = path.join(top, '.claude', 'settings.json')
    expect(lintPluginFile(RULE, GLOBS, file, '{"theme": "dark"}')).toEqual([])
  })

  // Claude Code reads `.claude/settings.json` as project settings, where `theme` takes effect.
  // The settings rules read that file, so the rule leaves it to them.
  check('stays silent for the settings.json of a .claude folder that is also a plugin root', () => {
    const top = tree({
      '.claude/.claude-plugin/plugin.json': '{"name": "p"}',
      '.claude/settings.json': '{"theme": "dark"}',
    })
    const file = path.join(top, '.claude', 'settings.json')
    expect(lintPluginFile(RULE, GLOBS, file, '{"theme": "dark"}')).toEqual([])
  })

  check('stays silent for a settings.json that is not at the plugin root', () => {
    const { dir } = pluginTree({ name: 'p' }, { 'sub/settings.json': '{"theme": "dark"}' })
    const file = path.join(dir, 'sub', 'settings.json')
    expect(lintPluginFile(RULE, GLOBS, file, '{"theme": "dark"}')).toEqual([])
  })

  check('stays silent for a settings.json in a folder that is no plugin', () => {
    const top = tree({ 'settings.json': '{"theme": "dark"}' })
    const file = path.join(top, 'settings.json')
    expect(lintPluginFile(RULE, GLOBS, file, '{"theme": "dark"}')).toEqual([])
  })

  check('stays silent for a manifest that does not parse', () => {
    const { dir } = pluginTree('{')
    expect(lintPlugin(RULE, dir, '{"name": "p", "settings": {"model": "x"}}')).toEqual([])
  })

  check('stays silent for a settings.json in a plugin with a manifest that does not parse', () => {
    const { dir } = pluginTree('{', { 'settings.json': '{"theme": "dark"}' })
    const file = path.join(dir, 'settings.json')
    expect(lintPluginFile(RULE, GLOBS, file, '{"theme": "dark"}')).toEqual([])
  })
})

describe(`${RULE} (plugin roots that the rule cannot read)`, () => {
  linked('stays silent for a plugin whose .claude-plugin links out of the repository', () => {
    const elsewhere = tree({ 'plugin.json': '{"name": "p"}' }, false)
    const top = tree({ 'settings.json': '{"theme": "dark"}' })
    link(top, '.claude-plugin', elsewhere)
    const file = path.join(top, 'settings.json')
    expect(lintPluginFile(RULE, GLOBS, file, '{"theme": "dark"}')).toEqual([])
  })

  linked('stays silent for a plugin root that links out of the repository', () => {
    const elsewhere = tree({ 'settings.json': '{"theme": "dark"}' }, false)
    const top = tree({ '.claude-plugin/plugin.json': '{"name": "p"}' })
    link(top, 'plugins/p', elsewhere)
    link(elsewhere, '.claude-plugin', path.join(top, '.claude-plugin'))
    const file = path.join(top, 'plugins', 'p', 'settings.json')
    expect(lintPluginFile(RULE, GLOBS, file, '{"theme": "dark"}')).toEqual([])
  })
})
