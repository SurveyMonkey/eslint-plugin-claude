// A manifest key that replaces a default folder makes Claude Code skip that
// folder, unless a path of the key is inside it (manifest reference, "How each
// key combines with its default location"). The trees are on disk, because the
// rule looks for the folder. The files glob is in tests/configs.test.ts.
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPlugin, pluginTree } from '../plugin-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'plugin-default-dir-shadowed'
const check = it
const linked = noLinks ? it.skip : check
const locked = chmodCannotBlock ? it.skip : check
const lint = (dir: string, code: string) => lintPlugin(RULE, dir, code)
const message = (key: string, folder: string) =>
  `\`${key}\` replaces the default \`${folder}/\` folder, so Claude Code ignores that folder. List a path inside it.`
const FOLDERS = {
  'commands/c.md': '# C\n',
  'agents/a.md': '# A\n',
  'output-styles/s.md': '# S\n',
  'workflows/w.js': '',
  'themes/t.json': '{}',
  'monitors/monitors.json': '[]',
}
const run = (fields: Record<string, unknown>, files: Record<string, string> = FOLDERS) => {
  const { dir, code } = pluginTree({ name: 'p', ...fields }, files)
  return lint(dir, code).map((m) => m.message)
}

describe(RULE, () => {
  check(
    'reports a key that points out of the default folder, on the member, with the full message',
    () => {
      const { dir, code } = pluginTree({ name: 'p', commands: './extras/' }, FOLDERS)
      const found = lint(dir, code)
      expect(found).toHaveLength(1)
      expect(found[0]).toMatchObject({
        ruleId: `claude/${RULE}`,
        messageId: 'shadowed',
        message: message('commands', 'commands'),
        line: 1,
        column: 13,
        endColumn: 35,
      })
    },
  )

  check.each([
    ['commands', { commands: './extras/c.md' }, 'commands', 'commands'],
    ['agents', { agents: ['./custom/a.md'] }, 'agents', 'agents'],
    ['outputStyles', { outputStyles: './styles/' }, 'outputStyles', 'output-styles'],
    ['workflows', { workflows: ['./flows'] }, 'workflows', 'workflows'],
    [
      'experimental.themes',
      { experimental: { themes: './colors/' } },
      'experimental.themes',
      'themes',
    ],
    [
      'experimental.monitors',
      { experimental: { monitors: './config/monitors.json' } },
      'experimental.monitors',
      'monitors',
    ],
  ])('reports %s', (_title, fields, key, folder) => {
    expect(run(fields)).toEqual([message(key, folder)])
  })

  check.each([
    ['a path of a folder with a sibling name', { commands: ['./commands-extra/c.md'] }],
    ['an array with no path inside', { commands: ['./a.md', './b/'] }],
    ['a path that leaves the folder and comes back', { commands: './commands/../extras' }],
    ['a path above the folder', { commands: './' }],
    ['an absolute path', { commands: '/commands/c.md' }],
    ['an empty string', { commands: '' }],
    ['an object map of inline content', { commands: { about: { content: 'x' } } }],
    ['an object map with a source out of the folder', { commands: { s: { source: './x/s.md' } } }],
    ['an object map with a source that is a number', { commands: { s: { source: 3 } } }],
    ['an object map with a source that is null', { commands: { s: { source: null } } }],
    ['an object map with entries that are no objects', { commands: { s: 'x', t: null } }],
    ['an inline monitors array', { experimental: { monitors: [{ name: 'm', command: 'x' }] } }],
    [
      'an array of strings and objects',
      { experimental: { monitors: ['./x.json', { name: 'm' }, 3] } },
    ],
  ])('reports %s', (_title, fields) => {
    const key = 'experimental' in fields ? 'experimental.monitors' : 'commands'
    const folder = 'experimental' in fields ? 'monitors' : 'commands'
    expect(run(fields)).toEqual([message(key, folder)])
  })

  check('reports each key on its own, in file order', () => {
    const fields = { agents: './x.md', commands: './y.md', experimental: { themes: './z' } }
    expect(run(fields)).toEqual([
      message('agents', 'agents'),
      message('commands', 'commands'),
      message('experimental.themes', 'themes'),
    ])
  })

  check('reports a folder with no file in it', () => {
    const { dir, code, top } = pluginTree({ name: 'p', commands: './x' }, {})
    mkdirSync(path.join(top, 'commands'))
    expect(lint(dir, code).map((m) => m.message)).toEqual([message('commands', 'commands')])
  })

  check('reports the last of two keys', () => {
    const { dir } = pluginTree({ name: 'p' }, FOLDERS)
    const code = '{"commands": "./commands/c.md", "commands": "./x.md"}'
    expect(lint(dir, code)).toHaveLength(1)
  })

  check('reports in a plugin below the repository root', () => {
    const { dir, code } = pluginTree(
      { name: 'p', commands: './x' },
      { 'commands/c.md': '# C\n' },
      'plugins/p/',
    )
    expect(lint(dir, code)).toHaveLength(1)
  })

  linked('reports a folder that is a link inside the plugin', () => {
    const { dir, code, top } = pluginTree({ name: 'p', commands: './x' }, { 'store/c.md': '# C\n' })
    link(top, 'commands', 'store')
    expect(lint(dir, code)).toHaveLength(1)
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['a file in the folder', { commands: './commands/c.md' }],
    ['the folder', { commands: './commands' }],
    ['the folder with a slash', { commands: './commands/' }],
    ['a path with no ./ prefix', { commands: 'commands/c.md' }],
    ['a path in a subfolder', { commands: './commands/ns/c.md' }],
    ['a path in normal form', { commands: './x/../commands/c.md' }],
    ['one path inside and one outside', { commands: ['./extras/', './commands/c.md'] }],
    [
      'an object map with a source inside the folder',
      { commands: { s: { source: './commands/c.md' } } },
    ],
    [
      'an object map with one source inside and one outside',
      {
        commands: { a: { content: 'x' }, s: { source: './commands/c.md' } },
      },
    ],
    ['agents inside agents/', { agents: ['./agents/a.md'] }],
    ['outputStyles inside output-styles/', { outputStyles: './output-styles/' }],
    ['workflows inside workflows/', { workflows: './workflows/w.js' }],
    ['themes inside themes/', { experimental: { themes: './themes/' } }],
    ['monitors in the default file', { experimental: { monitors: './monitors/monitors.json' } }],
  ])('stays silent for %s', (_title, fields) => {
    expect(run(fields)).toEqual([])
  })

  check.each([
    [
      'skills, which adds to its default folder',
      { skills: ['./extra-skills/'] },
      { 'skills/s/SKILL.md': '# S\n' },
    ],
    ['hooks, which merges', { hooks: './h.json' }, { 'hooks/hooks.json': '{}' }],
    ['mcpServers, which merges', { mcpServers: './m.json' }, { '.mcp.json': '{}' }],
    ['the top-level themes key', { themes: './x/' }, { 'themes/t.json': '{}' }],
    ['the top-level monitors key', { monitors: './x.json' }, { 'monitors/monitors.json': '[]' }],
    ['no key', {}, FOLDERS],
    ['a key and no default folder', { commands: './x/c.md' }, { 'other/c.md': '# C\n' }],
    ['a key and a default folder that is a file', { commands: './x/c.md' }, { commands: 'file' }],
    ['a different spelling of the key', { Commands: './x/c.md' }, FOLDERS],
    ['a key set to null', { commands: null }, FOLDERS],
    ['a key set to a number', { agents: 3 }, FOLDERS],
    ['a key set to true', { outputStyles: true }, FOLDERS],
    ['experimental as a string', { experimental: 'themes' }, FOLDERS],
    ['experimental with other keys', { experimental: { evals: './x' } }, FOLDERS],
  ])('stays silent for %s', (_title, fields, files) => {
    expect(run(fields, files)).toEqual([])
  })

  check('stays silent for a key whose last spelling points inside the folder', () => {
    const { dir } = pluginTree({ name: 'p' }, FOLDERS)
    expect(lint(dir, '{"commands": "./x.md", "commands": "./commands/c.md"}')).toEqual([])
  })

  check('stays silent for a directory with no manifest on disk', () => {
    const top = tree(FOLDERS)
    expect(lint(top, '{"name": "p", "commands": "./x"}')).toEqual([])
  })

  // The text on disk differs from the text that the linter gets, so that the linter parses it.
  check.each([
    ['a manifest that does not parse', '{'],
    ['a manifest that is an array', '[]'],
  ])('makes no report for %s on disk', (_title, text) => {
    const { dir } = pluginTree(text, FOLDERS)
    expect(lint(dir, '{"name": "p", "commands": "./x"}')).toEqual([])
  })

  linked('makes no report for a default folder that is a link out of the repository', () => {
    const elsewhere = tree({ 'c.md': '# C\n' })
    const { dir, code } = pluginTree({ name: 'p', commands: './x' }, {})
    link(dir, 'commands', elsewhere)
    expect(lint(dir, code)).toEqual([])
  })

  linked('makes no report for a default folder that is a dangling link', () => {
    const { dir, code } = pluginTree({ name: 'p', commands: './x' }, {})
    link(dir, 'commands', 'ghost')
    expect(lint(dir, code)).toEqual([])
  })

  linked('makes no report for a .claude-plugin directory out of the repository', () => {
    const elsewhere = tree({ 'p/plugin.json': '{"name": "p"}' })
    const top = tree(FOLDERS)
    link(top, '.claude-plugin', path.join(elsewhere, 'p'))
    expect(lint(top, '{"name": "p", "commands": "./x"}')).toEqual([])
  })

  locked('makes no report for a default folder that it cannot list', () => {
    const { dir, code } = pluginTree({ name: 'p', commands: './x' }, FOLDERS)
    expect(lint(dir, code)).toHaveLength(1)
    withoutAccess(path.join(dir, 'commands'), () => {
      expect(lint(dir, code)).toEqual([])
    })
  })
})
