// The rule reports a component path of an entry that is not a plugin path: no
// ./ prefix, "..", a backslash, a path that is not there, or a path that
// resolves out of the marketplace through a link. The paths are on disk,
// because the rule reads them. The files glob and the decoy files are in
// tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  link,
  lintMarketplace,
  manifestOf,
  marketplaceOf,
  noLinks,
  tree,
} from '../marketplace-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'marketplace-entry-component-paths'
const lint = (dir: string, code: string) => lintMarketplace(RULE, dir, code)
const FIELDS = ['commands', 'agents', 'skills', 'outputStyles', 'themes']
const PLUGIN = {
  'plugins/p/.claude-plugin/plugin.json': manifestOf({ name: 'p' }),
  'plugins/p/commands/c.md': '# C\n',
  'plugins/p/agents/a.md': '# A\n',
  'plugins/p/skills/s/SKILL.md': '---\nname: s\n---\n',
  'plugins/p/styles/t.md': '# T\n',
  'plugins/p/themes/x.json': '{}',
}
// A plugin below a marketplace root that is the directory `site` of the repository.
const SITE = { 'site/plugins/p/.claude-plugin/plugin.json': manifestOf({ name: 'p' }) }
const entry = (fields: Record<string, unknown>, source: unknown = './plugins/p') =>
  marketplaceOf([{ name: 'p', source, ...fields }])
const messageOf = (field: string, text: string, fault: string) => {
  const quoted = `The ${field} path "${text}"`
  const faults: Record<string, string> = {
    parent: `${quoted} contains "..", which fails validation. Write the path from the plugin root, with no "..".`,
    start: `${quoted} does not start with "./". Write the path from the plugin root, with the "./" prefix.`,
    backslash: `${quoted} contains a backslash. On macOS and Linux, Claude Code rejects it. Write the path with forward slashes.`,
    missing: `${quoted} does not exist in the plugin directory, so Claude Code does not load it.`,
    escapes: `${quoted} resolves out of the marketplace through a link, so Claude Code drops it. Keep the target of the link inside the marketplace.`,
  }
  return faults[fault]
}

describe(RULE, () => {
  it('reports a path with "..", on the string, with the full message', () => {
    const code = `{
  "name": "acme",
  "plugins": [
    { "name": "p", "source": "./plugins/p", "commands": "../shared.md" }
  ]
}`
    const messages = lint(tree(PLUGIN), code)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'parent',
      message: messageOf('commands', '../shared.md', 'parent'),
      line: 4,
      column: 57,
      endColumn: 71,
    })
  })

  it.each([
    ['a path with no ./ prefix', 'commands/c.md', 'start'],
    ['a path with a root slash', '/commands/c.md', 'start'],
    ['a path with a drive letter', 'C:/commands/c.md', 'start'],
    ['a network path', '//host/share', 'start'],
    ['a path with a root backslash', '\\commands\\c.md', 'start'],
    ['an empty string', '', 'start'],
    ['a dot, which only skills accepts', '.', 'start'],
    ['a path with ..', './commands/../commands/c.md', 'parent'],
    ['a path that starts with ..', '../c.md', 'parent'],
    ['a path with .. and a backslash', './a\\..\\b', 'parent'],
    ['a path with a backslash', './commands\\c.md', 'backslash'],
    ['a path with a backslash at the end', './commands/c.md\\', 'backslash'],
    ['a path that does not exist', './commands/nope.md', 'missing'],
    ['a path below a file', './commands/c.md/deeper', 'missing'],
  ])('reports %s', (_title, text, fault) => {
    const messages = lint(tree(PLUGIN), entry({ commands: text }))
    expect(messages.map((m) => m.message)).toEqual([messageOf('commands', text, fault)])
  })

  it('gives no parent report for a path with two dots in a name', () => {
    const files = { ...PLUGIN, 'plugins/p/a..b/c.md': '# C\n' }
    expect(lint(tree(files), entry({ commands: './a..b/c.md' }))).toEqual([])
  })

  it.each(FIELDS)('reports a bad path in %s, and names the field', (field) => {
    const messages = lint(tree(PLUGIN), entry({ [field]: './nope' }))
    expect(messages.map((m) => m.message)).toEqual([messageOf(field, './nope', 'missing')])
  })

  it('reports each bad element of an array, and no good element', () => {
    const skills = ['./skills', 'skills/s', 3, './skills/nope', null, './skills/../x', './skills/s']
    const messages = lint(tree(PLUGIN), entry({ skills }))
    expect(messages.map((m) => m.message)).toEqual([
      messageOf('skills', 'skills/s', 'start'),
      messageOf('skills', './skills/nope', 'missing'),
      messageOf('skills', './skills/../x', 'parent'),
    ])
  })

  it('reports the fields of one entry in file order, with one report for each path', () => {
    const fields = { agents: './a.md', commands: ['./c', 'd'], themes: '../t' }
    const messages = lint(tree(PLUGIN), entry(fields))
    expect(messages.map((m) => m.message)).toEqual([
      messageOf('agents', './a.md', 'missing'),
      messageOf('commands', './c', 'missing'),
      messageOf('commands', 'd', 'start'),
      messageOf('themes', '../t', 'parent'),
    ])
  })

  it('reports each entry on its own', () => {
    const code = marketplaceOf([
      { name: 'p', source: './plugins/p', commands: './nope' },
      { name: 'q', source: './plugins/p', commands: './commands' },
      { name: 'r', source: './plugins/p', agents: 'a.md' },
    ])
    expect(lint(tree(PLUGIN), code)).toHaveLength(2)
  })

  it('reads the last of two keys, as JSON.parse does', () => {
    const open = '{"plugins": [{"source": "./plugins/p", '
    expect(lint(tree(PLUGIN), `${open}"commands": "./c", "commands": "./commands"}]}`)).toEqual([])
    expect(
      lint(tree(PLUGIN), `${open}"commands": "./commands", "commands": "./c"}]}`),
    ).toHaveLength(1)
  })

  it('reports a path of a source with no plugin.json, and of a source with one', () => {
    const dir = tree({ 'plugins/q/x.txt': 'x', ...PLUGIN })
    expect(lint(dir, entry({ commands: './nope' }, './plugins/q'))).toHaveLength(1)
    expect(lint(dir, entry({ commands: './nope' }))).toHaveLength(1)
  })

  it('resolves a path from the plugin directory, not from the marketplace root', () => {
    const dir = tree({ ...PLUGIN, 'commands/root.md': '# R\n' })
    expect(lint(dir, entry({ commands: './commands/root.md' }))).toHaveLength(1)
    expect(lint(dir, entry({ commands: './commands/c.md' }))).toEqual([])
    expect(lint(dir, entry({ commands: './commands/root.md' }, '.'))).toEqual([])
  })

  it('reports a bare name under metadata.pluginRoot, and the source "."', () => {
    const bare = marketplaceOf([{ name: 'p', source: 'p', commands: './nope' }], {
      metadata: { pluginRoot: './plugins' },
    })
    expect(lint(tree(PLUGIN), bare)).toHaveLength(1)
    expect(lint(tree(PLUGIN), entry({ commands: './nope' }, '.'))).toHaveLength(1)
  })

  it('reports in a tree with no .git', () => {
    expect(lint(tree(PLUGIN, false), entry({ commands: './nope' }))).toHaveLength(1)
  })

  it.skipIf(noLinks)('reports a link out of the marketplace root, inside the repository', () => {
    const repo = tree({ ...SITE, 'shared/s.md': '# S\n' })
    const dir = path.join(repo, 'site')
    link(dir, 'plugins/p/commands', '../../../shared')
    link(dir, 'plugins/p/agents', '../../../shared/s.md')
    const messages = lint(
      dir,
      entry({ commands: ['./commands', './commands/s.md'], agents: './agents' }),
    )
    expect(messages.map((m) => m.message)).toEqual([
      messageOf('commands', './commands', 'escapes'),
      messageOf('commands', './commands/s.md', 'escapes'),
      messageOf('agents', './agents', 'escapes'),
    ])
  })
})

describe(`${RULE} (silent)`, () => {
  it.each([
    ['commands', './commands'],
    ['commands', './commands/'],
    ['commands', './commands/c.md'],
    ['commands', ['./commands', './commands/c.md']],
    ['agents', './agents/a.md'],
    ['skills', './skills'],
    ['skills', './skills/s'],
    ['skills', '.'],
    ['skills', './'],
    ['outputStyles', './styles/'],
    ['themes', './themes/x.json'],
    ['themes', './themes/./x.json'],
  ])('stays silent for %s set to %j', (field, value) => {
    expect(lint(tree(PLUGIN), entry({ [field]: value }))).toEqual([])
  })

  it('stays silent for an entry with no component field', () => {
    expect(lint(tree(PLUGIN), entry({ description: 'd', strict: true }))).toEqual([])
  })

  it('stays silent for the fields that other rules and files own, and for other spellings', () => {
    const fields = {
      hooks: './nope.json',
      mcpServers: './nope.json',
      lspServers: '../nope',
      Commands: './nope',
      command: './nope',
      skill: './nope',
      'output-styles': './nope',
    }
    expect(lint(tree(PLUGIN), entry(fields))).toEqual([])
  })

  it.each([
    ['null', null],
    ['a number', 3],
    ['a boolean', true],
    ['an object map of commands', { deploy: { source: './nope.md' } }],
    ['an empty array', []],
    ['an array of non-strings', [3, null, true, {}, ['./nope']]],
  ])('stays silent for a value that is %s', (_title, value) => {
    expect(lint(tree(PLUGIN), entry({ commands: value }))).toEqual([])
  })

  it.each([
    ['a source that does not exist', {}],
    ['a manifest that does not parse', { 'plugins/p/.claude-plugin/plugin.json': '{' }],
    ['a manifest that is an array', { 'plugins/p/.claude-plugin/plugin.json': '[]' }],
  ])('stays silent for %s', (_title, files) => {
    expect(lint(tree(files), entry({ commands: './nope', agents: '../x' }))).toEqual([])
  })

  it('stays silent for a source that is a file', () => {
    const dir = tree({ plugins: 'a file' })
    expect(lint(dir, entry({ commands: './nope', agents: '../x' }))).toEqual([])
    const nested = tree({ 'plugins/p': 'a file' })
    expect(lint(nested, entry({ commands: './nope', agents: '../x' }))).toEqual([])
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
    expect(lint(tree(PLUGIN), entry({ commands: './nope', agents: '../x' }, source))).toEqual([])
  })

  it('reports a path with ./ inside it but not at the start', () => {
    const messages = lint(tree(PLUGIN), entry({ commands: 'commands/./c.md' }))
    expect(messages.map((m) => m.message)).toEqual([
      messageOf('commands', 'commands/./c.md', 'start'),
    ])
  })

  it.skipIf(noLinks)('stays silent for a valid path in a marketplace behind a link', () => {
    const top = tree(Object.fromEntries(Object.entries(PLUGIN).map(([k, v]) => ['real/' + k, v])))
    link(top, 'alias', 'real')
    const dir = path.join(top, 'alias')
    expect(lint(dir, entry({ commands: './commands/c.md' }))).toEqual([])
    expect(lint(dir, entry({ commands: './nope' }))).toHaveLength(1)
    const root = marketplaceOf([{ name: 'p', source: '.', skills: '.' }])
    expect(lint(dir, root)).toEqual([])
  })

  it('stays silent for a bare name under a pluginRoot that the format rule reports', () => {
    const code = marketplaceOf([{ name: 'p', source: 'p', commands: './nope' }], {
      metadata: { pluginRoot: '../plugins' },
    })
    expect(lint(tree(PLUGIN), code)).toEqual([])
  })

  it('stays silent for an entry that is not an object', () => {
    expect(lint(tree(PLUGIN), marketplaceOf(['p', null, 3]))).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a link inside the plugin directory', () => {
    const dir = tree(PLUGIN)
    link(dir, 'plugins/p/alias', 'commands')
    link(dir, 'plugins/p/file-alias', 'commands/c.md')
    expect(lint(dir, entry({ commands: ['./alias', './alias/c.md', './file-alias'] }))).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a link to another place in the marketplace', () => {
    const dir = tree({ ...PLUGIN, 'shared/skills/k/SKILL.md': '---\nname: k\n---\n' })
    link(dir, 'plugins/p/skills/k', '../../../shared/skills/k')
    link(dir, 'plugins/p/commands/up', '../../..')
    expect(lint(dir, entry({ skills: ['./skills/k', './skills/k/SKILL.md'] }))).toEqual([])
    expect(lint(dir, entry({ commands: './commands/up' }))).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a part that is a link out of the repository', () => {
    const outside = tree({ 'c.md': '# C\n' })
    const dir = tree(PLUGIN)
    link(dir, 'plugins/p/far', outside)
    link(dir, 'plugins/p/far-file', path.join(outside, 'c.md'))
    const paths = ['./far', './far/c.md', './far/nope', './far-file']
    expect(lint(dir, entry({ commands: paths }))).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a dangling link, and for a link to itself', () => {
    const dir = tree(PLUGIN)
    link(dir, 'plugins/p/dead', 'gone')
    link(dir, 'plugins/p/loop', 'loop')
    expect(lint(dir, entry({ commands: ['./dead', './dead/x', './loop', './loop/x'] }))).toEqual([])
  })

  it.skipIf(noLinks)('stays silent for a link out of the root in a tree with no .git', () => {
    const top = tree({ ...SITE, 'shared/s.md': '# S\n' }, false)
    const dir = path.join(top, 'site')
    link(dir, 'plugins/p/commands', '../../../shared')
    expect(lint(dir, entry({ commands: ['./commands', './commands/s.md'] }))).toEqual([])
  })

  it.skipIf(chmodCannotBlock)('stays silent for a part that the rule cannot read', () => {
    const dir = tree(PLUGIN)
    withoutAccess(path.join(dir, 'plugins', 'p', 'commands'), () => {
      expect(lint(dir, entry({ commands: ['./commands/c.md', './commands/nope'] }))).toEqual([])
    })
  })

  it.skipIf(noLinks)('stays silent for a source that is a link out of the marketplace root', () => {
    const repo = tree({ ...PLUGIN })
    const dir = path.join(repo, 'site')
    link(dir, 'plugins/p', '../../plugins/p')
    expect(lint(dir, entry({ commands: './nope' }))).toEqual([])
  })
})
