// The rule reports an event that the entry `hooks` and the `plugin.json` hooks
// both declare, when `strict` is unset or true. The sources are on disk,
// because the rule reads them. The files glob and the decoy files are in
// tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { HOOK_EVENTS } from '../../src/data/hook-events.ts'
import {
  link,
  lintMarketplace,
  manifestOf,
  marketplaceOf,
  noLinks,
  tree,
} from '../marketplace-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'marketplace-entry-hooks-override'
const lint = (dir: string, code: string) => lintMarketplace(RULE, dir, code)
const MATCHERS = [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'check' }] }]
const withHooks = (hooks: unknown) => ({
  'plugins/p/.claude-plugin/plugin.json': manifestOf({ name: 'p', hooks }),
})
const PLUGIN = withHooks({ Stop: MATCHERS, PreToolUse: MATCHERS })
const entry = (fields: Record<string, unknown>, source: unknown = './plugins/p') =>
  marketplaceOf([{ name: 'p', source, ...fields }])
const message = (event: string) =>
  `The entry and plugin.json both set hooks for "${event}". The matchers of the entry replace the matchers of plugin.json for this event. Declare the matchers for "${event}" in one place.`

describe(RULE, () => {
  it('reports the event, on the member, with the full message', () => {
    const code = `{
  "name": "acme",
  "plugins": [
    { "name": "p", "source": "./plugins/p", "hooks": { "Stop": [] } }
  ]
}`
    const messages = lint(tree(PLUGIN), code)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'override',
      message: message('Stop'),
      line: 4,
      column: 56,
      endColumn: 66,
    })
  })

  it.each(HOOK_EVENTS)('reports the event %s', (event) => {
    const dir = tree(withHooks({ [event]: MATCHERS }))
    const messages = lint(dir, entry({ hooks: { [event]: MATCHERS } }))
    expect(messages.map((m) => m.message)).toEqual([message(event)])
  })

  it('reports each shared event once, in file order, and no event that only one file sets', () => {
    const dir = tree(withHooks({ Stop: MATCHERS, PreToolUse: MATCHERS, SessionEnd: MATCHERS }))
    const hooks = { SessionEnd: MATCHERS, Notification: MATCHERS, Stop: MATCHERS }
    const messages = lint(dir, entry({ hooks }))
    expect(messages.map((m) => m.message)).toEqual([message('SessionEnd'), message('Stop')])
  })

  it.each([
    ['an empty array', []],
    ['an empty object', {}],
    ['null', null],
    ['a number', 3],
  ])('reports an event set to %s in the entry, because the key is set', (_title, value) => {
    expect(lint(tree(PLUGIN), entry({ hooks: { Stop: value } }))).toHaveLength(1)
  })

  it.each([
    ['an empty array', []],
    ['an empty object', {}],
    ['null', null],
    ['a number', 3],
  ])('reports an event that plugin.json sets to %s, because the key is set', (_title, value) => {
    const dir = tree(withHooks({ Stop: value }))
    expect(lint(dir, entry({ hooks: { Stop: MATCHERS } }))).toHaveLength(1)
  })

  it('reads the plugin.json hooks as an array of inline objects', () => {
    const dir = tree(withHooks([{ Stop: MATCHERS }, { PreToolUse: MATCHERS }]))
    const messages = lint(dir, entry({ hooks: { PreToolUse: MATCHERS, Stop: MATCHERS } }))
    expect(messages.map((m) => m.message)).toEqual([message('PreToolUse'), message('Stop')])
  })

  it('reads the inline objects of a plugin.json array that also holds paths and other values', () => {
    const dir = tree(withHooks(['./hooks/extra.json', { Stop: MATCHERS }, 3, null, ['Stop']]))
    expect(lint(dir, entry({ hooks: { Stop: MATCHERS } }))).toHaveLength(1)
  })

  it('reports for strict set to true, and for strict unset', () => {
    const hooks = { Stop: MATCHERS }
    expect(lint(tree(PLUGIN), entry({ strict: true, hooks }))).toHaveLength(1)
    expect(lint(tree(PLUGIN), entry({ hooks }))).toHaveLength(1)
  })

  it('reports each entry on its own', () => {
    const dir = tree({
      ...PLUGIN,
      'plugins/q/.claude-plugin/plugin.json': manifestOf({ name: 'q', hooks: { Stop: [] } }),
    })
    const code = marketplaceOf([
      { name: 'p', source: './plugins/p', hooks: { Stop: [] } },
      { name: 'q', source: './plugins/q', hooks: { PreToolUse: [] } },
      { name: 'r', source: './plugins/q', hooks: { Stop: [] } },
    ])
    expect(lint(dir, code)).toHaveLength(2)
  })

  it('reads the last of two hooks keys, and the last of two event keys', () => {
    const hooks = (text: string) => `{"plugins": [{"source": "./plugins/p", ${text}}]}`
    const twice = hooks('"hooks": {"Notification": []}, "hooks": {"Stop": []}')
    expect(lint(tree(PLUGIN), twice)).toHaveLength(1)
    const reverse = hooks('"hooks": {"Stop": []}, "hooks": {"Notification": []}')
    expect(lint(tree(PLUGIN), reverse)).toEqual([])
    expect(lint(tree(PLUGIN), hooks('"hooks": {"Stop": 1, "Stop": 2}'))).toHaveLength(1)
  })

  it('reports a bare name under metadata.pluginRoot, and the source "."', () => {
    const dir = tree({
      ...PLUGIN,
      '.claude-plugin/plugin.json': manifestOf({ name: 'root', hooks: { Stop: [] } }),
    })
    const bare = marketplaceOf([{ name: 'p', source: 'p', hooks: { Stop: [] } }], {
      metadata: { pluginRoot: './plugins' },
    })
    expect(lint(dir, bare)).toHaveLength(1)
    expect(lint(dir, entry({ hooks: { Stop: [] } }, '.'))).toHaveLength(1)
  })

  it.skipIf(noLinks)('reports a source that is a link inside the marketplace root', () => {
    const dir = tree(PLUGIN)
    link(dir, 'plugins/alias', 'p')
    expect(lint(dir, entry({ hooks: { Stop: [] } }, './plugins/alias'))).toHaveLength(1)
  })

  it('reports in a tree with no .git', () => {
    expect(lint(tree(PLUGIN, false), entry({ hooks: { Stop: [] } }))).toHaveLength(1)
  })
})

describe(`${RULE} (silent)`, () => {
  it.each([
    ['strict false', { strict: false }],
    ['strict as the string "false"', { strict: 'false' }],
    ['strict as null', { strict: null }],
    ['strict as 0', { strict: 0 }],
    ['strict as an object', { strict: {} }],
  ])('stays silent with %s', (_title, fields) => {
    expect(lint(tree(PLUGIN), entry({ ...fields, hooks: { Stop: MATCHERS } }))).toEqual([])
  })

  it('stays silent when the files declare different events', () => {
    const hooks = { Notification: MATCHERS, SessionEnd: MATCHERS }
    expect(lint(tree(PLUGIN), entry({ hooks }))).toEqual([])
  })

  it('stays silent for other spellings of an event, which are other keys', () => {
    const hooks = { stop: MATCHERS, STOP: MATCHERS, 'Stop ': MATCHERS, pretooluse: MATCHERS }
    expect(lint(tree(PLUGIN), entry({ hooks }))).toEqual([])
  })

  it('stays silent for a key that is no event name, even when both files set it', () => {
    const dir = tree(withHooks({ Bogus: MATCHERS, hooks: MATCHERS }))
    expect(lint(dir, entry({ hooks: { Bogus: MATCHERS, hooks: MATCHERS } }))).toEqual([])
  })

  it('stays silent for a plugin.json hooks object with the hooks wrapper of a hooks file', () => {
    const dir = tree(withHooks({ hooks: { Stop: MATCHERS } }))
    expect(lint(dir, entry({ hooks: { Stop: MATCHERS } }))).toEqual([])
  })

  it.each([
    ['a path string', './hooks/hooks.json'],
    ['an array of paths', ['./a.json', './b.json']],
    ['an empty array', []],
    ['an empty object', {}],
    ['null', null],
    ['a number', 3],
    ['a boolean', true],
  ])('stays silent when plugin.json hooks is %s', (_title, hooks) => {
    expect(lint(tree(withHooks(hooks)), entry({ hooks: { Stop: MATCHERS } }))).toEqual([])
  })

  it('stays silent when plugin.json sets no hooks, or only the entry does', () => {
    const dir = tree({ 'plugins/p/.claude-plugin/plugin.json': manifestOf({ name: 'p' }) })
    expect(lint(dir, entry({ hooks: { Stop: MATCHERS } }))).toEqual([])
  })

  it('stays silent when only plugin.json sets hooks', () => {
    expect(lint(tree(PLUGIN), entry({}))).toEqual([])
  })

  it.each([
    ['a path string', './hooks.json'],
    ['an array of objects', [{ Stop: MATCHERS }]],
    ['an array of paths', ['./hooks.json']],
    ['a number', 3],
    ['null', null],
    ['a boolean', true],
  ])('stays silent when the entry hooks is %s', (_title, hooks) => {
    expect(lint(tree(PLUGIN), entry({ hooks }))).toEqual([])
  })

  it('stays silent when the source has no plugin.json, because the entry is then the manifest', () => {
    const dir = tree({ 'plugins/p/x.txt': 'x', 'plugins/q/.claude-plugin/other.json': '{}' })
    const hooks = { Stop: MATCHERS }
    expect(lint(dir, entry({ hooks }))).toEqual([])
    expect(lint(dir, entry({ hooks }, './plugins/q'))).toEqual([])
  })

  it.each([
    ['a source that does not exist', {}],
    ['a manifest that does not parse', { 'plugins/p/.claude-plugin/plugin.json': '{' }],
    ['a manifest that is an array', { 'plugins/p/.claude-plugin/plugin.json': '[]' }],
    ['a source that is a file', { plugins: 'a file' }],
  ])('stays silent for %s', (_title, files) => {
    expect(lint(tree(files), entry({ hooks: { Stop: MATCHERS } }))).toEqual([])
  })

  it.each([
    ['an object source', { source: 'github', repo: 'a/b' }],
    ['a source with no ./ prefix', 'plugins/p'],
    ['a bare name with no pluginRoot', 'p'],
    ['an absolute source', '/plugins/p'],
    ['a source with ..', './plugins/../plugins/p'],
    ['an empty source', ''],
    ['a source that is not a string', 3],
  ])('stays silent for %s', (_title, source) => {
    expect(lint(tree(PLUGIN), entry({ hooks: { Stop: MATCHERS } }, source))).toEqual([])
  })

  it('stays silent for a bare name under a pluginRoot that the format rule reports', () => {
    const code = marketplaceOf([{ name: 'p', source: 'p', hooks: { Stop: [] } }], {
      metadata: { pluginRoot: '../plugins' },
    })
    expect(lint(tree(PLUGIN), code)).toEqual([])
  })

  it('stays silent for an entry that is not an object', () => {
    expect(lint(tree(PLUGIN), marketplaceOf(['p', null, 3]))).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a manifest that is a dangling link', () => {
    const dir = tree({})
    link(dir, 'plugins/p/.claude-plugin/plugin.json', 'gone.json')
    expect(lint(dir, entry({ hooks: { Stop: [] } }))).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a manifest link out of the repository', () => {
    const outside = tree({ 'plugin.json': manifestOf({ name: 'p', hooks: { Stop: [] } }) })
    const dir = tree({})
    link(dir, 'plugins/p/.claude-plugin/plugin.json', path.join(outside, 'plugin.json'))
    expect(lint(dir, entry({ hooks: { Stop: [] } }))).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a source that is a link out of the marketplace root', () => {
    const repo = tree({
      'shared/p/.claude-plugin/plugin.json': manifestOf({ name: 'p', hooks: { Stop: [] } }),
    })
    const dir = path.join(repo, 'site')
    link(dir, 'plugins/p', '../../shared/p')
    expect(lint(dir, entry({ hooks: { Stop: [] } }))).toEqual([])
  })

  it.skipIf(noLinks)(
    'stays silent for a link out of the repository, and for a dangling link',
    () => {
      const outside = tree({
        'p/.claude-plugin/plugin.json': manifestOf({ name: 'p', hooks: { Stop: [] } }),
      })
      const dir = tree({})
      link(dir, 'plugins/far', path.join(outside, 'p'))
      link(dir, 'plugins/dead', 'gone')
      expect(lint(dir, entry({ hooks: { Stop: [] } }, './plugins/far'))).toEqual([])
      expect(lint(dir, entry({ hooks: { Stop: [] } }, './plugins/dead'))).toEqual([])
    },
  )

  it.skipIf(noLinks)('stays silent for a link out of the root in a tree with no .git', () => {
    const top = tree(
      { 'shared/p/.claude-plugin/plugin.json': manifestOf({ name: 'p', hooks: { Stop: [] } }) },
      false,
    )
    const dir = path.join(top, 'site')
    link(dir, 'plugins/p', '../../shared/p')
    expect(lint(dir, entry({ hooks: { Stop: [] } }))).toEqual([])
  })

  it.skipIf(chmodCannotBlock)('stays silent for a manifest that the rule cannot read', () => {
    const dir = tree(PLUGIN)
    withoutAccess(path.join(dir, 'plugins', 'p'), () => {
      expect(lint(dir, entry({ hooks: { Stop: [] } }))).toEqual([])
    })
  })
})
