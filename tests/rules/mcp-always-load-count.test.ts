// A server with `alwaysLoad: true` loads all its tools upfront and holds startup for up to five
// seconds (MCP page, "Exempt a server from deferral"). The docs give no number, so the option
// `max` has the default 2 of the inventory row. A plugin declares servers in `.mcp.json`, in
// `.json` files and inline, so the rule counts the sources of one plugin. It stays silent when it
// cannot read a source.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { repo } from '../agent-settings.test-support.ts'
import { ids, mapOf } from '../mcp-server-rule.test-support.ts'

const NAME = 'mcp-always-load-count'
const NAMES = ['a', 'b', 'c', 'd']
const load = (names: string[], value: unknown = true) =>
  Object.fromEntries(names.map((n) => [n, { command: 'x', alwaysLoad: value }]))

/** Lint `code` as `file` of a repository with `files`, with the options `options`. */
function lint(
  code: string,
  file: string,
  files: Record<string, string> = {},
  options: object[] = [],
) {
  const filename = path.join(repo(files), file)
  return new Linter({ cwd: path.parse(filename).root }).verify(
    code,
    [
      {
        files: ['**/*.json'],
        plugins: { json, claude: plugin },
        language: 'json/json',
        rules: { [`claude/${NAME}`]: ['error', ...options] },
      },
    ],
    { filename },
  )
}
const project = (names: string[], options: object[] = [], value: unknown = true) =>
  lint(mapOf(load(names, value)), '.mcp.json', {}, options)
const manifest = (value: object) => JSON.stringify({ name: 'p', ...value })
const PLUGIN = 'p/.claude-plugin/plugin.json'

it('reports three servers with alwaysLoad, with no option, on the first', () => {
  const code = mapOf(load(NAMES.slice(0, 3)))
  const found = lint(code, '.mcp.json')
  expect(ids(found)).toEqual(['tooMany'])
  expect(found[0]).toMatchObject({ line: 1, column: code.indexOf('true') + 1 })
  expect(found[0]?.message).toContain('At least 3')
  expect(found[0]?.message).toContain('`alwaysLoad: true`')
  expect(found[0]?.message).toContain('2')
})
it('stays silent for two, and for three at max 3; reports four at max 3', () => {
  expect(ids(project(NAMES.slice(0, 2)))).toEqual([])
  expect(ids(project(NAMES.slice(0, 3), [{ max: 3 }]))).toEqual([])
  expect(ids(project(NAMES, [{ max: 3 }]))).toEqual(['tooMany'])
  expect(project(NAMES, [{ max: 3 }])[0]?.message).toContain('3')
  expect(ids(project(['a'], [{ max: 0 }]))).toEqual(['tooMany'])
})
it('counts a literal true only', () => {
  for (const value of [false, 'true', 1, null]) {
    expect(ids(project(NAMES, [], value)), String(value)).toEqual([])
  }
  const mixed = mapOf({ a: load(['x']).x, b: { command: 'x' }, c: load(['x']).x, d: load(['x']).x })
  expect(ids(lint(mixed, '.mcp.json'))).toEqual(['tooMany'])
})
it('counts a server once when a name repeats, as JSON.parse keeps the last', () => {
  const twice = `{"mcpServers": {"a": {"alwaysLoad": true}, "a": {"alwaysLoad": true}, "b": {"alwaysLoad": true}}}`
  expect(ids(lint(twice, '.mcp.json'))).toEqual([])
  const first = `{"mcpServers": {"a": {"alwaysLoad": true}, "a": {"alwaysLoad": false}, "b": {"alwaysLoad": true}, "c": {"alwaysLoad": true}}}`
  expect(ids(lint(first, '.mcp.json'))).toEqual([])
})
it('counts the sources of one plugin, and reports in each file with an own server', () => {
  const files = {
    'p/.mcp.json': mapOf(load(['a', 'b'])),
    'p/more.json': mapOf(load(['c'])),
    [PLUGIN]: manifest({ mcpServers: ['./more.json', load(['d'])] }),
  }
  const inline = manifest({ mcpServers: ['./more.json', load(['d'])] })
  // The manifest holds `c` and `d`, and the root file `a` and `b`: four in all.
  expect(ids(lint(inline, PLUGIN, files))).toEqual(['tooMany'])
  const root = lint(files['p/.mcp.json'] as string, 'p/.mcp.json', files)
  expect(ids(root)).toEqual(['tooMany'])
  expect(root[0]?.message).toContain('At least 4')
  // A server of a declared file reports on the path in the manifest.
  const declared = manifest({ mcpServers: './more.json' })
  const found = lint(declared, PLUGIN, { ...files, [PLUGIN]: declared })
  expect(ids(found)).toEqual(['tooMany'])
  expect(found[0]).toMatchObject({ column: declared.indexOf('"./more.json"') + 1 })
  // A file with no own server with alwaysLoad has nothing to point at.
  const plain = manifest({ mcpServers: { e: { command: 'x' } } })
  expect(ids(lint(plain, PLUGIN, { ...files, [PLUGIN]: plain }))).toEqual([])
})
it('reads the linted text of the root file, and not the text on disk', () => {
  const files = {
    'p/.mcp.json': mapOf(load(['a'])),
    [PLUGIN]: manifest({ mcpServers: load(['b']) }),
  }
  expect(ids(lint(mapOf(load(['a', 'x', 'y'])), 'p/.mcp.json', files))).toEqual(['tooMany'])
  expect(
    ids(lint(mapOf(load(['a'])), 'p/.mcp.json', { ...files, 'p/.mcp.json': mapOf(load(NAMES)) })),
  ).toEqual([])
})
it('stays silent when a source it would count cannot be read, as it can replace a server', () => {
  const three = load(['a', 'b', 'c'])
  expect(ids(lint(manifest({ mcpServers: three }), PLUGIN))).toEqual(['tooMany'])
  for (const gap of ['./gone.json', './b.mcpb', 'https://x.test/m.json']) {
    expect(ids(lint(manifest({ mcpServers: [three, gap] }), PLUGIN)), gap).toEqual([])
  }
  const files = { 'p/more.json': '{ not json' }
  expect(ids(lint(manifest({ mcpServers: [three, './more.json'] }), PLUGIN, files))).toEqual([])
  const shape = { 'p/more.json': '{"mcpServers": "x"}' }
  expect(ids(lint(manifest({ mcpServers: [three, './more.json'] }), PLUGIN, shape))).toEqual([])
  const list = { 'p/more.json': '[]' }
  expect(ids(lint(manifest({ mcpServers: [three, './more.json'] }), PLUGIN, list))).toEqual([])
})
it('stays silent when the root file of a plugin does not read or has no server map', () => {
  const three = manifest({ mcpServers: load(['a', 'b', 'c']) })
  expect(ids(lint(three, PLUGIN, { 'p/.mcp.json': '{ not json' }))).toEqual([])
  expect(ids(lint(three, PLUGIN, { 'p/.mcp.json': '{"mcpServers": []}' }))).toEqual([])
})
it('stays silent for a plugin .mcp.json when its manifest does not parse', () => {
  const files = { [PLUGIN]: '{ not json' }
  expect(ids(lint(mapOf(load(NAMES)), 'p/.mcp.json', files))).toEqual([])
  const fine = { [PLUGIN]: manifest({}) }
  expect(ids(lint(mapOf(load(NAMES)), 'p/.mcp.json', fine))).toEqual(['tooMany'])
})
it('counts a server with a repeated alwaysLoad by its last member', () => {
  const entry = '{"command": "x", "alwaysLoad": true, "alwaysLoad": false}'
  const code = `{"mcpServers": {"a": ${entry}, "b": ${entry}, "c": ${entry}}}`
  expect(ids(lint(code, '.mcp.json'))).toEqual([])
})
it('applies the default max when the options are an empty object', () => {
  expect(ids(lint(mapOf(load(NAMES.slice(0, 3))), '.mcp.json', {}, [{}]))).toEqual(['tooMany'])
})
it('ignores a root file that is a link out of the repository', () => {
  const root = repo({})
  const outside = mkdtempSync(path.join(tmpdir(), 'mcp-always-outside-'))
  try {
    writeFileSync(path.join(outside, 'm.json'), mapOf(load(NAMES)))
    mkdirSync(path.join(root, 'p'), { recursive: true })
    symlinkSync(path.join(outside, 'm.json'), path.join(root, 'p', '.mcp.json'))
    const file = path.join(root, PLUGIN)
    const run = (text: string) =>
      new Linter({ cwd: path.parse(file).root }).verify(
        text,
        [
          {
            files: ['**/*.json'],
            plugins: { json, claude: plugin },
            language: 'json/json',
            rules: { [`claude/${NAME}`]: 'error' },
          },
        ],
        { filename: file },
      )
    // The link leaves the repository, so the rule cannot read the root file and stays silent.
    expect(ids(run(manifest({ mcpServers: load(['a', 'b', 'c']) })))).toEqual([])
    expect(ids(run(manifest({ mcpServers: load(['a', 'b']) })))).toEqual([])
  } finally {
    rmSync(outside, { recursive: true, force: true })
  }
})
it('stays silent for a project file that holds two, whatever its siblings hold', () => {
  const files = { 'other/.mcp.json': mapOf(load(NAMES)) }
  expect(ids(lint(mapOf(load(['a', 'b'])), '.mcp.json', files))).toEqual([])
})
it('stays silent for a path that Claude Code does not read, and for a map that is not an object', () => {
  expect(ids(lint(mapOf(load(NAMES)), '.claude/.mcp.json'))).toEqual([])
  expect(ids(lint('[]', '.mcp.json'))).toEqual([])
  expect(
    ids(lint('{"mcpServers": {"a": 5, "b": [], "c": {"alwaysLoad": true}}}', '.mcp.json')),
  ).toEqual([])
})

describe('mcp-always-load-count option schema', () => {
  const run = (options: object[]) => () => project(['a'], options)
  it('accepts an empty object and each integer from 0', () => {
    expect(run([{}])).not.toThrow()
    expect(run([{ max: 0 }])).not.toThrow()
    expect(run([{ max: 10 }])).not.toThrow()
  })
  it('refuses a negative value, a fraction, a string and an unknown key', () => {
    expect(run([{ max: 2 }])).not.toThrow()
    expect(run([{ max: -1 }])).toThrow()
    expect(run([{ max: 1.5 }])).toThrow()
    expect(run([{ max: '2' }])).toThrow()
    expect(run([{ min: 2 }])).toThrow()
  })
})

it('counts a server of one name once across the sources of a plugin, as the last one', () => {
  const files = {
    'p/.mcp.json': mapOf(load(['a', 'b'])),
    [PLUGIN]: manifest({ mcpServers: { a: { command: 'x', alwaysLoad: false }, ...load(['c']) } }),
  }
  // The inline `a` replaces the `a` of the root file, so `b` and `c` are the two that count.
  expect(ids(lint(files[PLUGIN], PLUGIN, files))).toEqual([])
  expect(ids(lint(files['p/.mcp.json'], 'p/.mcp.json', files))).toEqual([])
  const reload = manifest({ mcpServers: { a: { command: 'x', alwaysLoad: true }, ...load(['c']) } })
  expect(ids(lint(reload, PLUGIN, { ...files, [PLUGIN]: reload }))).toEqual(['tooMany'])
})
