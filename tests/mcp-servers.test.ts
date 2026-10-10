// The reader that the `.mcp.json` rules share: where a file sits, and the members of its
// server map. The map holds the servers, with or without the `mcpServers` wrapper.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { keyOf } from '../src/marketplace-json.ts'
import {
  isUnreadMcpPath,
  type McpFileKind,
  mcpFileKind,
  REMOTE_SERVER_TYPES,
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
