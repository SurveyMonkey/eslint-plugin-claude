// A `deny` rule `"*"` removes every tool, and `"mcp__*"` removes every MCP tool:
// https://code.claude.com/docs/en/permissions#tool-name-wildcards
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-deny-all-tools'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]

const perms = (fields: Record<string, string[]>) => JSON.stringify({ permissions: fields })
const ids = (text: string, file = PROJECT) =>
  lintJson(name, text, file).map((message) => message.messageId)

describe(`${name}: the report`, () => {
  it('reports "*" in deny, in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids(perms({ deny: ['*'] }), file), file).toEqual(['all'])
    }
  })

  it('reports "mcp__*" in deny, in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids(perms({ deny: ['mcp__*'] }), file), file).toEqual(['mcp'])
    }
  })

  it('says what each rule removes', () => {
    const [all] = lintJson(name, perms({ deny: ['*'] }), PROJECT)
    expect(all?.message).toContain('every tool')
    const [mcp] = lintJson(name, perms({ deny: ['mcp__*'] }), PROJECT)
    expect(mcp?.message).toContain('every MCP tool')
  })

  it('reports each entry, at its line and column', () => {
    const text = '{\n  "permissions": {\n    "deny": ["Read", "*", "mcp__*"]\n  }\n}'
    expect(lintJson(name, text, PROJECT).map(({ line, column }) => [line, column])).toEqual([
      [3, 22],
      [3, 27],
    ])
  })
})

describe(`${name}: the silent cases`, () => {
  it('is silent for a narrower deny rule', () => {
    for (const rule of [
      'Bash',
      'mcp__github',
      'mcp__github__*',
      'mcp__*__read',
      'B*',
      'Bash(*)',
      '*(x)',
      'mcp__*(x)',
    ]) {
      expect(ids(perms({ deny: [rule] })), rule).toEqual([])
    }
  })

  it('is silent in allow and ask', () => {
    for (const list of ['allow', 'ask']) {
      expect(ids(perms({ [list]: ['*', 'mcp__*'] })), list).toEqual([])
    }
  })

  it('is silent for a rule that does not parse, and for a list that is not an array', () => {
    expect(ids(perms({ deny: ['*('] }))).toEqual([])
    expect(ids(JSON.stringify({ permissions: { deny: '*' } }))).toEqual([])
    expect(ids('{}')).toEqual([])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(perms({ deny: ['*'] }), HIDDEN)).toEqual([])
  })
})
