// The reader that the `.mcp.json` rules share: where a file sits, and the members of its
// server map. The map holds the servers, with or without the `mcpServers` wrapper.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { keyOf } from '../src/marketplace-json.ts'
import {
  declaredMcpStrings,
  isUnreadMcpPath,
  MANAGED_SERVER_TYPES,
  type McpFileKind,
  mcpFileKind,
  parseUrl,
  pluginMcpDeclarations,
  policyKey,
  REMOTE_SERVER_TYPES,
  readJsonBody,
  repeatedDeclarations,
  SERVER_NAME_PATTERN,
  serverMembers,
} from '../src/mcp-servers.ts'

// `repo/` is the repository. `outside/` is a sibling that holds the target of a link.
let scratch = ''
beforeEach(() => {
  scratch = mkdtempSync(path.join(tmpdir(), 'mcp-servers-'))
  mkdirSync(path.join(scratch, 'repo', '.git'), { recursive: true })
  mkdirSync(path.join(scratch, 'outside'))
})
afterEach(() => rmSync(scratch, { recursive: true, force: true }))

const repo = (...parts: string[]) => path.join(scratch, 'repo', ...parts)
const put = (file: string, text = '{}') => {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, text)
  return file
}

describe('isUnreadMcpPath', () => {
  it('is true for the three paths under .claude/', () => {
    expect(isUnreadMcpPath(repo('.claude', '.mcp.json'))).toBe(true)
    expect(isUnreadMcpPath(repo('.claude', 'mcp.json'))).toBe(true)
    expect(isUnreadMcpPath(repo('.claude', 'config', 'mcp.json'))).toBe(true)
    expect(isUnreadMcpPath(repo('packages', 'a', '.claude', '.mcp.json'))).toBe(true)
  })
  it('is false for the project file and for near misses', () => {
    expect(isUnreadMcpPath(repo('.mcp.json'))).toBe(false)
    expect(isUnreadMcpPath(repo('mcp.json'))).toBe(false)
    expect(isUnreadMcpPath(repo('config', 'mcp.json'))).toBe(false)
    expect(isUnreadMcpPath(repo('.claude', 'x', 'mcp.json'))).toBe(false)
    expect(isUnreadMcpPath(repo('.claude', 'skills', 's', '.mcp.json'))).toBe(false)
    expect(isUnreadMcpPath(repo('.claude', 'config', '.mcp.json'))).toBe(false)
    expect(isUnreadMcpPath(path.sep)).toBe(false)
  })
})

describe('mcpFileKind', () => {
  it('is project for a .mcp.json in a directory with no manifest', () => {
    expect(mcpFileKind(put(repo('.mcp.json')))).toBe('project')
    expect(mcpFileKind(repo('packages', 'a', '.mcp.json'))).toBe('project')
  })
  it('is plugin for a .mcp.json at a plugin root', () => {
    put(repo('p', '.claude-plugin', 'plugin.json'))
    expect(mcpFileKind(repo('p', '.mcp.json'))).toBe('plugin')
  })
  it('is null for a path under .claude/, even in a plugin', () => {
    put(repo('p', '.claude-plugin', 'plugin.json'))
    expect(mcpFileKind(repo('.claude', '.mcp.json'))).toBeNull()
    expect(mcpFileKind(repo('p', '.claude', '.mcp.json'))).toBeNull()
  })
  it.skipIf(process.platform === 'win32')(
    'is null when .claude-plugin/ is a link to a directory out of the repository',
    () => {
      put(path.join(scratch, 'outside', 'meta', 'plugin.json'))
      mkdirSync(repo('p'), { recursive: true })
      symlinkSync(path.join(scratch, 'outside', 'meta'), repo('p', '.claude-plugin'))
      expect(mcpFileKind(repo('p', '.mcp.json'))).toBeNull()
    },
  )
})

describe('serverMembers', () => {
  /** The names of the server map of `code`, read in the JSON language. */
  function namesOf(code: string, kind: McpFileKind): string[] {
    const names: string[] = []
    const probe = {
      rules: {
        probe: {
          create: () => ({
            Document(node: { body: Parameters<typeof serverMembers>[0] }) {
              names.push(...serverMembers(node.body, kind).map((m) => keyOf(m.name)))
            },
          }),
        },
      },
    }
    new Linter().verify(
      code,
      [
        {
          files: ['**/*.json'],
          plugins: { json, probe },
          language: 'json/json',
          rules: { 'probe/probe': 'error' },
        },
      ],
      { filename: 'x.json' },
    )
    return names
  }

  it('keeps only the last of two members with one name', () => {
    const code = '{"mcpServers": {"a": 1, "b": 2, "a": 3}}'
    expect(namesOf(code, 'project')).toEqual(['b', 'a'])
    expect(namesOf('{"a": 1, "a": 2}', 'plugin')).toEqual(['a'])
  })

  it('reads the mcpServers object of a project file and of a plugin file', () => {
    const code = '{"mcpServers": {"a": {}, "b": 1}}'
    expect(namesOf(code, 'project')).toEqual(['a', 'b'])
    expect(namesOf(code, 'plugin')).toEqual(['a', 'b'])
  })
  it('reads the last mcpServers member', () => {
    expect(namesOf('{"mcpServers": {"a": {}}, "mcpServers": {"b": {}}}', 'project')).toEqual(['b'])
  })
  it('reads the top-level object of a plugin file with no wrapper only', () => {
    expect(namesOf('{"a": {}, "b": {}}', 'plugin')).toEqual(['a', 'b'])
    expect(namesOf('{"a": {}, "b": {}}', 'project')).toEqual([])
  })
  it('gives nothing for a wrapper or a body that is not an object', () => {
    expect(namesOf('{"mcpServers": []}', 'plugin')).toEqual([])
    expect(namesOf('{"mcpServers": null}', 'project')).toEqual([])
    expect(namesOf('[{"a": {}}]', 'plugin')).toEqual([])
    expect(namesOf('"a"', 'project')).toEqual([])
  })
})

it('lists the remote server types', () => {
  expect([...REMOTE_SERVER_TYPES].sort()).toEqual(['http', 'sse', 'streamable-http', 'ws'])
})

it('lists the types of a managedMcpServers entry, which leave out ws', () => {
  expect([...MANAGED_SERVER_TYPES].sort()).toEqual(['http', 'sse', 'streamable-http'])
})

it('accepts letters, numbers, hyphens and underscores in a server name', () => {
  for (const name of ['a', 'A-z_0-9', '-', '_']) {
    expect(SERVER_NAME_PATTERN.test(name)).toBe(true)
  }
  for (const name of ['', 'a b', 'a.b', '*', 'a\n', 'é']) {
    expect(SERVER_NAME_PATTERN.test(name)).toBe(false)
  }
})

describe('declaredMcpStrings', () => {
  /** The strings that `declaredMcpStrings` reads from the manifest text `code`. */
  function stringsOf(code: string): string[] {
    const values: string[] = []
    const probe = {
      rules: {
        probe: {
          create: () => ({
            Document(node: { body: Parameters<typeof declaredMcpStrings>[0] }) {
              values.push(...declaredMcpStrings(node.body).map(({ value }) => value))
            },
          }),
        },
      },
    }
    new Linter().verify(
      code,
      [
        {
          files: ['**/*.json'],
          plugins: { json, probe },
          language: 'json/json',
          rules: { 'probe/probe': 'error' },
        },
      ],
      { filename: 'x.json' },
    )
    return values
  }

  it('reads a string value', () => {
    expect(stringsOf('{"mcpServers": "./a.mcpb"}')).toEqual(['./a.mcpb'])
  })
  it('reads the string items of an array, and skips the other items', () => {
    expect(stringsOf('{"mcpServers": ["./a.json", {"db": {}}, 1, null, "./b.dxt", []]}')).toEqual([
      './a.json',
      './b.dxt',
    ])
  })
  it('reads the last mcpServers member', () => {
    expect(stringsOf('{"mcpServers": "./a.json", "mcpServers": "./b.json"}')).toEqual(['./b.json'])
    expect(stringsOf('{"mcpServers": "./a.json", "mcpServers": {}}')).toEqual([])
  })
  it('gives nothing for an inline map, a scalar, a missing key or a body that is no object', () => {
    expect(stringsOf('{"mcpServers": {"a": "./a.json"}}')).toEqual([])
    expect(stringsOf('{"mcpServers": 1}')).toEqual([])
    expect(stringsOf('{"mcpServers": null}')).toEqual([])
    expect(stringsOf('{"name": "p"}')).toEqual([])
    expect(stringsOf('["./a.json"]')).toEqual([])
    expect(stringsOf('"./a.json"')).toEqual([])
  })
})

// The real path of the repository, so that a bound compares equal on macOS, where the
// temporary directory is a link.
const rp = (...parts: string[]) => path.join(realpathSync(repo()), ...parts)

describe('readJsonBody', () => {
  it('gives the top-level value of a file that parses', () => {
    expect(readJsonBody(put(rp('a.json'), '{"x": 1}'), rp())?.type).toBe('Object')
  })
  it('gives null for a file that is not there, does not parse, or has a link out', () => {
    expect(readJsonBody(rp('none.json'), rp())).toBeNull()
    expect(readJsonBody(put(rp('bad.json'), '{ no'), rp())).toBeNull()
    expect(
      readJsonBody(put(rp('deep.json'), `${'['.repeat(200_000)}${']'.repeat(200_000)}`), rp()),
    ).toBeNull()
    put(path.join(realpathSync(scratch), 'outside', 'o.json'), '{}')
    symlinkSync(path.join(realpathSync(scratch), 'outside', 'o.json'), rp('link.json'))
    expect(readJsonBody(rp('link.json'), rp())).toBeNull()
  })
})

describe('pluginMcpDeclarations', () => {
  const names = (root: string, manifest: string | null) =>
    pluginMcpDeclarations(
      root,
      manifest === null ? null : (readJsonBody(put(rp('m.json'), manifest), rp()) ?? null),
    ).map((d) => `${d.name}@${d.from}`)

  it('lists .mcp.json first, then each manifest value in order', () => {
    put(rp('p', '.mcp.json'), '{"mcpServers": {"a": {}}}')
    put(rp('p', 'f.json'), '{"b": {}}')
    const manifest = '{"mcpServers": ["./f.json", {"c": {}}, "x.mcpb", 7]}'
    expect(names(rp('p'), manifest)).toEqual(['a@.mcp.json', 'b@./f.json', 'c@an inline map'])
  })
  it('reads the root file alone for a plugin with no manifest', () => {
    put(rp('q', '.mcp.json'), '{"a": {}}')
    expect(names(rp('q'), null)).toEqual(['a@.mcp.json'])
  })
  it('keeps the last of two members of one name in one source', () => {
    const manifest = '{"mcpServers": {"a": {"command": "x"}, "a": {"command": "y"}}}'
    expect(names(rp('r'), manifest)).toEqual(['a@an inline map'])
  })
})

describe('repeatedDeclarations', () => {
  it('gives each later declaration of a name with the source of the first', () => {
    put(rp('p', '.mcp.json'), '{"a": {}, "b": {}}')
    const manifest = readJsonBody(put(rp('m.json'), '{"mcpServers": {"b": {}, "c": {}}}'), rp())
    const found = repeatedDeclarations(pluginMcpDeclarations(rp('p'), manifest ?? null))
    expect(found.map(({ declaration, earlier }) => [declaration.name, earlier])).toEqual([
      ['b', '.mcp.json'],
    ])
  })
})

describe('policyKey', () => {
  it('tells entries apart by kind and value', () => {
    expect(policyKey({ serverName: 'a' })).toBe('name:a')
    expect(policyKey({ serverUrl: 'https://a' })).toBe('url:https://a')
    expect(policyKey({ serverCommand: ['a', 'b'] })).toBe('command:["a","b"]')
  })
  it('gives undefined for an entry that Claude Code strips', () => {
    for (const entry of [
      { serverName: 'a b' },
      { serverName: 1 },
      { serverCommand: ['a', 1] },
      { serverName: 'a', serverUrl: 'b' },
      {},
      [],
      null,
      'a',
    ]) {
      expect(policyKey(entry)).toBeUndefined()
    }
  })
})

describe('policyKey for a denylist', () => {
  it('accepts a name that the allowlist pattern rejects', () => {
    expect(policyKey({ serverName: 'a b' }, 'deniedMcpServers')).toBe('name:a b')
    expect(policyKey({ serverName: '*' }, 'deniedMcpServers')).toBe('name:*')
    expect(policyKey({ serverName: 'a b' })).toBeUndefined()
  })
  it('rejects an empty name and a name with outer whitespace', () => {
    for (const serverName of ['', ' a', 'a ']) {
      expect(policyKey({ serverName }, 'deniedMcpServers')).toBeUndefined()
    }
  })
})

describe('parseUrl', () => {
  it('reads a URL with a variable in the port', () => {
    for (const url of [
      `http://h.test:\${PORT}`,
      `http://h.test:\${PORT}?q=1`,
      `http://h.test:\${PORT:-80}/x`,
      `http://h.test:\${PORT}#f`,
    ]) {
      expect(parseUrl(url)?.hostname).toBe('h.test')
    }
  })
  it('gives null for a text that does not parse', () => {
    expect(parseUrl(`http://h.test:\${P}x`)).toBeNull()
    expect(parseUrl('')).toBeNull()
  })
})
