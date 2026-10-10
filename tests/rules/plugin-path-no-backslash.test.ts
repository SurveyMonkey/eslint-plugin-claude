// On macOS and Linux, Claude Code rejects a component path that has a backslash in it, even when the
// path stays inside the plugin (loading reference, "Paths that escape the plugin directory"). The
// rule reads the path of each component key of `plugin.json`. The files glob is in
// tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { lintPlugin, pluginTree } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-path-no-backslash'
const check = it

const message = (key: string, entry: string) =>
  `The \`${key}\` path "${entry}" has a backslash. On macOS and Linux, Claude Code rejects it, so the component loads on Windows only. Write the path with forward slashes, such as ./commands/deploy.md.`
const run = (fields: Record<string, unknown>) => {
  const { dir, code } = pluginTree({ name: 'p', ...fields })
  return lintPlugin(RULE, dir, code)
}

describe(RULE, () => {
  check('reports a commands path with backslashes, with the full message and the position', () => {
    const found = run({ commands: '.\\commands\\a.md' })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'backslash',
      message: message('commands', '.\\commands\\a.md'),
      line: 1,
      column: 24,
      endLine: 1,
      endColumn: 43,
    })
  })

  check.each([
    ['skills', { skills: ['./extra\\skills'] }, './extra\\skills'],
    ['commands', { commands: ['./commands\\a.md'] }, './commands\\a.md'],
    ['agents', { agents: './agents\\a.md' }, './agents\\a.md'],
    ['hooks', { hooks: './config\\hooks.json' }, './config\\hooks.json'],
    ['mcpServers', { mcpServers: ['./mcp\\servers.json'] }, './mcp\\servers.json'],
    ['lspServers', { lspServers: '.\\.lsp.json' }, '.\\.lsp.json'],
    ['outputStyles', { outputStyles: './styles\\' }, './styles\\'],
    ['workflows', { workflows: './flows\\a.js' }, './flows\\a.js'],
    ['experimental.themes', { experimental: { themes: './t\\a.json' } }, './t\\a.json'],
    ['experimental.monitors', { experimental: { monitors: './m\\m.json' } }, './m\\m.json'],
    ['themes', { themes: './t\\a.json' }, './t\\a.json'],
    ['monitors', { monitors: './m\\m.json' }, './m\\m.json'],
  ])('reports a path of the %s key', (key, fields, entry) => {
    expect(run(fields).map((m) => m.message)).toEqual([message(key, entry)])
  })

  check('reports the source of each entry in the object map of commands', () => {
    const found = run({
      commands: {
        ok: { source: './commands/ok.md' },
        a: { source: './commands\\a.md', description: 'd' },
        b: { source: '.\\commands\\b.md' },
      },
    })
    expect(found.map((m) => m.message)).toEqual([
      message('commands', './commands\\a.md'),
      message('commands', '.\\commands\\b.md'),
    ])
  })

  check.each([
    ['a URL under a key that is not mcpServers', { commands: 'https://example.com/a\\b.md' }],
    ['a URL that is not at the start', { mcpServers: './x/https://a\\b' }],
    ['a name that only starts with http', { mcpServers: 'https-tools\\a.md' }],
  ])('reports %s', (_title, fields) => {
    expect(run(fields).map((m) => m.messageId)).toEqual(['backslash'])
  })

  check('leaves a source that is not a string in the object map of commands', () => {
    const found = run({
      commands: { a: { source: 3 }, b: { source: { x: '.\\y' } }, c: { source: null }, d: 'x' },
    })
    expect(found).toEqual([])
  })

  check('reports each path of an array and leaves the others alone', () => {
    const found = run({ commands: ['./a.md', './b\\c.md', './d.md', './e\\f.md'] })
    expect(found.map((m) => m.message)).toEqual([
      message('commands', './b\\c.md'),
      message('commands', './e\\f.md'),
    ])
  })

  check('reports the path of an array that also holds an inline object', () => {
    const found = run({
      hooks: [{ PostToolUse: [] }, './config\\hooks.json'],
    })
    expect(found.map((m) => m.message)).toEqual([message('hooks', './config\\hooks.json')])
  })

  check('reports the last of two keys, as JSON.parse reads them', () => {
    const { dir, code } = pluginTree(
      '{"name": "p", "commands": "./a\\\\b.md", "commands": "./c.md"}',
    )
    expect(lintPlugin(RULE, dir, code)).toEqual([])
    const second = pluginTree('{"name": "p", "commands": "./c.md", "commands": "./a\\\\b.md"}')
    expect(lintPlugin(RULE, second.dir, second.code).map((m) => m.message)).toEqual([
      message('commands', './a\\b.md'),
    ])
  })

  check('reports in a plugin below the repository root', () => {
    const { dir, code } = pluginTree({ name: 'p', commands: './a\\b.md' }, {}, 'plugins/p/')
    expect(lintPlugin(RULE, dir, code).map((m) => m.messageId)).toEqual(['backslash'])
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['a path with forward slashes', { commands: './commands/a.md' }],
    ['an array of paths with forward slashes', { skills: ['./a', './b/'], agents: ['./a.md'] }],
    ['a command with a content and no source', { commands: { a: { content: 'a\\b' } } }],
    [
      'a command description with a backslash',
      { commands: { a: { source: './a.md', description: 'a\\b' } } },
    ],
    ['a plugin description with a backslash', { description: 'C:\\tools' }],
    [
      'an inline hook command with a backslash',
      { hooks: { PostToolUse: [{ hooks: [{ type: 'command', command: 'run .\\x.cmd' }] }] } },
    ],
    [
      'an inline server with a backslash',
      { mcpServers: { s: { command: 'node', args: ['.\\s.js'] } } },
    ],
    [
      'an inline monitor with a backslash',
      { experimental: { monitors: [{ name: 'm', command: 'run .\\x', description: 'd' }] } },
    ],
    [
      'a source member in an inline server, which is no commands map',
      { mcpServers: { s: { source: '.\\x' } } },
    ],
    ['a bundle URL with a backslash', { mcpServers: 'https://example.com/a\\b.mcpb' }],
    ['an http bundle URL with a backslash', { mcpServers: 'http://example.com/a\\b.mcpb' }],
    [
      'a path of a key that is not a component key',
      { icon: './logo\\a.png', types: './t\\a.d.ts' },
    ],
    ['the eval directory', { experimental: { evals: 'quality\\evals' } }],
    ['a value that is a number', { commands: 3 }],
    ['an array element that is a number', { commands: [3, null] }],
    ['a key in another object', { metadata: { commands: './a\\b.md' } }],
  ])('stays silent for %s', (_title, fields) => {
    expect(run(fields)).toEqual([])
  })

  check('stays silent for a manifest that does not parse', () => {
    const { dir } = pluginTree('{')
    expect(lintPlugin(RULE, dir, '{"name": "p", "commands": ".\\\\a.md"}')).toEqual([])
  })
})
