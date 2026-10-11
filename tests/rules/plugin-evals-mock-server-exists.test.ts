// A directory `mocks/<server>/` of an eval suite names a server in the MCP configuration of the
// plugin (plugin evals page, "Mock MCP servers"). ESLint has no language for the directory, so the
// rule lints the manifest of the plugin and lists the mock directories on disk. The servers come from
// the `.mcp.json` of the plugin and the `mcpServers` key of its manifest. The trees are on disk.
// The files glob is in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPlugin, pluginTree } from '../plugin-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'plugin-evals-mock-server-exists'
const check = it
const linked = noLinks ? it.skip : check
const MOCK = 'evals/mocks/tracker/create_issue.md'
const SERVERS = JSON.stringify({ mcpServers: { github: { command: 'x' } } })

/** The messages for a plugin with the files `files`, keyed by their path from the plugin root. */
function messages(files: Record<string, string>, manifest: unknown = { name: 'p' }) {
  const { dir, code } = pluginTree(manifest, files)
  return lintPlugin(RULE, dir, code).map((m) => m.message)
}
const UNKNOWN = (dir: string, server: string, known: string) =>
  `The directory "${dir}" holds mocks for the server "${server}". The MCP configuration of the plugin does not declare a server with that name. ${known}`
const NONE = 'It declares no server.'
const KNOWN = (...names: string[]) => `It declares ${names.map((n) => `"${n}"`).join(', ')}.`

describe(RULE, () => {
  check(
    'reports a mock directory with no server of that name, at the start of the manifest',
    () => {
      const { dir, code } = pluginTree({ name: 'p' }, { '.mcp.json': SERVERS, [MOCK]: 'x' })
      const found = lintPlugin(RULE, dir, code)
      expect(found).toHaveLength(1)
      expect(found[0]).toMatchObject({
        ruleId: `claude/${RULE}`,
        messageId: 'unknown',
        message: UNKNOWN('evals/mocks/tracker', 'tracker', KNOWN('github')),
        line: 1,
        column: 1,
      })
    },
  )

  check('says when the plugin declares no server', () => {
    expect(messages({ [MOCK]: 'x' })).toEqual([UNKNOWN('evals/mocks/tracker', 'tracker', NONE)])
  })

  check('lists each declared server, in the order of declaration', () => {
    const servers = JSON.stringify({ mcpServers: { b: { command: 'x' }, a: { command: 'x' } } })
    expect(messages({ '.mcp.json': servers, [MOCK]: 'x' })).toEqual([
      UNKNOWN('evals/mocks/tracker', 'tracker', KNOWN('b', 'a')),
    ])
  })

  check('stays silent for a server of the .mcp.json of the plugin', () => {
    expect(messages({ '.mcp.json': SERVERS, 'evals/mocks/github/x.md': 'x' })).toEqual([])
    const bare = JSON.stringify({ github: { command: 'x' } })
    expect(messages({ '.mcp.json': bare, 'evals/mocks/github/x.md': 'x' })).toEqual([])
  })

  check('stays silent for a server of the mcpServers key of the manifest', () => {
    const inline = { name: 'p', mcpServers: { tracker: { command: 'x' } } }
    expect(messages({ [MOCK]: 'x' }, inline)).toEqual([])
    const file = { name: 'p', mcpServers: './servers.json' }
    expect(messages({ 'servers.json': SERVERS, 'evals/mocks/github/x.md': 'x' }, file)).toEqual([])
  })

  check('reports a mock directory of a case, and one of a case in a group', () => {
    const files = {
      '.mcp.json': SERVERS,
      'evals/first/prompt.md': 'x',
      'evals/first/mocks/tracker/t.md': 'x',
      'evals/g/h/case.yaml': 'x',
      'evals/g/h/mocks/other/t.md': 'x',
      'evals/g/h/mocks/github/t.md': 'x',
    }
    expect(messages(files)).toEqual([
      UNKNOWN('evals/first/mocks/tracker', 'tracker', KNOWN('github')),
      UNKNOWN('evals/g/h/mocks/other', 'other', KNOWN('github')),
    ])
  })

  check('reports each unknown directory, once, in name order', () => {
    const files = {
      'evals/mocks/b/t.md': 'x',
      'evals/mocks/a/t.md': 'x',
      'evals/mocks/a/u.md': 'x',
    }
    expect(messages(files)).toEqual([
      UNKNOWN('evals/mocks/a', 'a', NONE),
      UNKNOWN('evals/mocks/b', 'b', NONE),
    ])
  })

  check('reports an eval directory that is a case once', () => {
    expect(messages({ 'evals/prompt.md': 'x', 'evals/mocks/a/t.md': 'x' })).toEqual([
      UNKNOWN('evals/mocks/a', 'a', NONE),
    ])
  })

  check('compares the name as it is written, and reads no inherited name as a server', () => {
    const files = { '.mcp.json': SERVERS, 'evals/mocks/GitHub/t.md': 'x' }
    expect(messages(files)).toEqual([UNKNOWN('evals/mocks/GitHub', 'GitHub', KNOWN('github'))])
    expect(
      messages({ 'evals/mocks/constructor/t.md': 'x', 'evals/mocks/toString/t.md': 'x' }),
    ).toEqual([
      UNKNOWN('evals/mocks/constructor', 'constructor', NONE),
      UNKNOWN('evals/mocks/toString', 'toString', NONE),
    ])
  })

  check('stays silent for the saved answers, files in mocks, and folders below a server', () => {
    const files = {
      'evals/mocks/.replay/gh/answer.md': 'x',
      'evals/mocks/readme.md': 'x',
      'evals/mocks/github/fixtures/f.json': '{}',
      '.mcp.json': SERVERS,
    }
    expect(messages(files)).toEqual([])
  })

  check('stays silent for a mocks directory that is not at the eval directory or at a case', () => {
    const files = {
      'evals/first/prompt.md': 'x',
      'evals/first/sub/mocks/x/t.md': 'x',
      'evals/other/mocks/x/t.md': 'x',
      'mocks/x/t.md': 'x',
      'src/mocks/x/t.md': 'x',
    }
    expect(messages(files)).toEqual([])
  })

  check('reads the eval directory of experimental.evals', () => {
    const manifest = { name: 'p', experimental: { evals: 'qa' } }
    const files = { 'qa/mocks/x/t.md': 'x', 'evals/mocks/y/t.md': 'x' }
    expect(messages(files, manifest)).toEqual([UNKNOWN('qa/mocks/x', 'x', NONE)])
  })

  check('stays silent for a plugin without an eval directory', () => {
    expect(messages({ '.mcp.json': SERVERS })).toEqual([])
  })

  check('stays silent when a source of servers cannot be read', () => {
    const mock = { [MOCK]: 'x' }
    expect(messages({ ...mock, '.mcp.json': '{' })).toEqual([])
    expect(messages({ ...mock, '.mcp.json': '[]' })).toEqual([])
    expect(messages({ ...mock, '.mcp.json': '{"mcpServers": []}' })).toEqual([])
    expect(messages(mock, { name: 'p', mcpServers: './missing.json' })).toEqual([])
    expect(messages({ ...mock, 'bad.json': '{' }, { name: 'p', mcpServers: './bad.json' })).toEqual(
      [],
    )
    expect(messages(mock, { name: 'p', mcpServers: 'https://example.com/b.mcpb' })).toEqual([])
    expect(
      messages(mock, { name: 'p', mcpServers: ['./a.json', { x: { command: 'y' } }] }),
    ).toEqual([])
  })

  const unreadable = chmodCannotBlock ? it.skip : check
  unreadable('stays silent when the .mcp.json cannot be read', () => {
    const { dir, code } = pluginTree({ name: 'p' }, { '.mcp.json': SERVERS, [MOCK]: 'x' })
    const found = withoutAccess(path.join(dir, '.mcp.json'), () => lintPlugin(RULE, dir, code))
    expect(found).toEqual([])
  })

  unreadable('stays silent for a mocks directory that cannot be listed', () => {
    const { dir, code } = pluginTree({ name: 'p' }, { [MOCK]: 'x' })
    const found = withoutAccess(path.join(dir, 'evals/mocks'), () => lintPlugin(RULE, dir, code))
    expect(found).toEqual([])
  })

  check('stays silent when the manifest is in no plugin root', () => {
    const top = tree({ [MOCK]: 'x' })
    expect(lintPlugin(RULE, path.join(top, 'p'), '{"name": "p"}')).toEqual([])
  })

  linked('stays silent when the root of the plugin links out of the repository', () => {
    const outside = tree({ [MOCK]: 'x', '.claude-plugin/plugin.json': '{"name": "p"}' }, false)
    const top = tree({})
    link(top, 'plug', outside)
    expect(lintPlugin(RULE, path.join(top, 'plug'), '{"name": "p"}')).toEqual([])
  })

  linked('stays silent when mocks links out of the repository, and reads a link in it', () => {
    const outside = tree({ 'x/t.md': 'x' }, false)
    const { dir, code } = pluginTree(
      { name: 'p' },
      { 'evals/first/prompt.md': 'x', 'real/y/t.md': 'x' },
    )
    link(dir, 'evals/mocks', outside)
    expect(lintPlugin(RULE, dir, code)).toEqual([])
    link(dir, 'evals/first/mocks', '../../real')
    expect(lintPlugin(RULE, dir, code).map((m) => m.message)).toEqual([
      UNKNOWN('evals/first/mocks/y', 'y', NONE),
    ])
  })

  linked('does not enter a server directory that is a link', () => {
    const { dir, code } = pluginTree(
      { name: 'p' },
      { 'real/y/t.md': 'x', 'evals/first/prompt.md': 'x' },
    )
    link(dir, 'evals/mocks/y', '../../real/y')
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })
})
