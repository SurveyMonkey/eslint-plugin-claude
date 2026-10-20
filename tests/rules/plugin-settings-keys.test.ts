// A plugin sets default settings in a root `settings.json` or in the manifest key `settings`. Two
// keys take effect, `agent` and `subagentStatusLine`, and Claude Code drops every other key
// (components page, "Default settings"; manifest reference, "settings"). The trees are on disk,
// because the rule finds the plugin root. The files glob is in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, marketplaceOf, noLinks, tree } from '../marketplace-tree.test-support.ts'
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
/** The message ID and the key name in the text of each message. */
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

  check('reads the last settings key of a manifest, as JSON.parse keeps it', () => {
    const last = '{"name": "p", "settings": {"agent": "a"}, "settings": {"model": "x"}}'
    expect(keys(lintPlugin(RULE, pluginTree(last).dir, last))).toEqual([['unsupported', 'model']])
    const first = '{"name": "p", "settings": {"model": "x"}, "settings": {"agent": "a"}}'
    expect(lintPlugin(RULE, pluginTree(first).dir, first)).toEqual([])
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

  // `claude plugin validate` 2.1.304 passes a root `settings.json` that is an array (#383).
  check.each([
    ['null', 'null'],
    ['a string', '"theme"'],
    ['an array', '[{"theme": "dark"}]'],
    ['a number', '3'],
  ])('reports a root settings.json that is %s, on the value', (_title, text) => {
    const found = inFile(text)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      messageId: 'notObject',
      message:
        'The default settings of a plugin are not an object, so Claude Code takes no key from this file. Write an object with `agent` or `subagentStatusLine`.',
      line: 1,
      column: 1,
      endColumn: text.length + 1,
    })
  })

  check('reports a root settings.json that is not an object in a plugin with no manifest', () => {
    const top = tree({
      '.claude-plugin/marketplace.json': marketplaceOf([{ name: 'p', source: './plugins/p' }]),
      'plugins/p/settings.json': '[]',
    })
    const file = path.join(top, 'plugins', 'p', 'settings.json')
    expect(lintPluginFile(RULE, GLOBS, file, '[]').map((m) => m.messageId)).toEqual(['notObject'])
  })

  check('reports the manifest settings when the root settings.json sets a supported key', () => {
    const files = { 'settings.json': '{"agent": "a"}' }
    const found = inManifest({ name: 'p', settings: { agent: 'b', model: 'x' } }, files)
    expect(keys(found)).toEqual([['unsupported', 'model']])
  })
})

// A marketplace lists `plugins/p`, which has no `plugin.json`. The manifest is optional, and the
// entry is then the manifest (manifest reference, "Manifest file"; ADR 001 Decision 10, #384).
describe(`${RULE} (a listed plugin with no manifest)`, () => {
  /** The messages for `text` as `plugins/p/settings.json`, with the marketplace entry `entry`. */
  const listed = (text: string, entry: Record<string, unknown> = {}) => {
    const top = tree({
      '.claude-plugin/marketplace.json': marketplaceOf([
        { name: 'p', source: './plugins/p', ...entry },
      ]),
      'plugins/p/settings.json': text,
    })
    return lintPluginFile(RULE, GLOBS, path.join(top, 'plugins', 'p', 'settings.json'), text)
  }

  check('reports a dropped key in the root settings.json', () => {
    const found = listed('{"agent": "a", "theme": "dark"}')
    expect(found.map((m) => [m.messageId, m.message, m.column])).toEqual([
      ['unsupported', message('theme'), 16],
    ])
  })

  check('stays silent when the entry sets a key that replaces a default location', () => {
    // The plugin-root check cannot model such a plugin, so no report rests on it (ADR 001
    // Decision 10).
    expect(listed('{"theme": "dark"}', { agents: ['./x.md'] })).toEqual([])
  })

  check('stays silent for the settings.json of a folder that no marketplace lists', () => {
    const top = tree({
      '.claude-plugin/marketplace.json': marketplaceOf([{ name: 'p', source: './plugins/p' }]),
      'plugins/q/settings.json': '{"theme": "dark"}',
    })
    const file = path.join(top, 'plugins', 'q', 'settings.json')
    expect(lintPluginFile(RULE, GLOBS, file, '{"theme": "dark"}')).toEqual([])
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

  // `plugin-manifest-location` reports a `settings.json` inside `.claude-plugin/`. Claude Code
  // does not read it as the default settings, so this rule leaves it alone.
  check('stays silent for a settings.json inside .claude-plugin/', () => {
    const { dir } = pluginTree({ name: 'p' }, { '.claude-plugin/settings.json': '[]' })
    const file = path.join(dir, '.claude-plugin', 'settings.json')
    expect(lintPluginFile(RULE, GLOBS, file, '{"theme": "dark"}')).toEqual([])
    expect(lintPluginFile(RULE, GLOBS, file, '[]')).toEqual([])
  })

  // An editor can lint a buffer that differs from the file on disk. A manifest that is not an
  // object is a fault for validate, not for this rule.
  check('stays silent for a manifest text that is not an object', () => {
    const { dir } = pluginTree({ name: 'p' })
    expect(lintPlugin(RULE, dir, '[]')).toEqual([])
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
    for (const text of ['{"theme": "dark"}', '[]', 'null']) {
      expect(lintPluginFile(RULE, GLOBS, file, text)).toEqual([])
    }
  })

  check('stays silent for a settings.json in a folder that is no plugin', () => {
    const top = tree({ 'settings.json': '{"theme": "dark"}' })
    const file = path.join(top, 'settings.json')
    for (const text of ['{"theme": "dark"}', '[]', 'null']) {
      expect(lintPluginFile(RULE, GLOBS, file, text)).toEqual([])
    }
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
