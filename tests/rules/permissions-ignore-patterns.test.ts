// The key `permissions.deny` replaces the deprecated `ignorePatterns` configuration:
// https://code.claude.com/docs/en/settings-reference#permissionsdeny
// The rule reports the top-level key `ignorePatterns` in every settings file.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-ignore-patterns'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]

const run = (text: string, file = PROJECT) => lintJson(name, text, file)
const ids = (text: string, file = PROJECT) => run(text, file).map((message) => message.messageId)

describe(`${name}: the report`, () => {
  it('reports a top-level ignorePatterns key, in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids('{ "ignorePatterns": ["secrets/**"] }', file), file).toEqual(['deprecated'])
    }
  })

  it('reports a key with any value, once', () => {
    for (const value of ['[]', 'null', '"x"', '{}', 'false']) {
      expect(ids(`{ "ignorePatterns": ${value} }`), value).toEqual(['deprecated'])
    }
  })

  it('reports the name of the key, at its line and column', () => {
    const [message] = run('{\n  "env": {},\n  "ignorePatterns": []\n}')
    expect([message?.line, message?.column]).toEqual([3, 3])
  })

  it('reports the last of two keys, as JSON.parse reads them', () => {
    const text = '{\n  "ignorePatterns": [],\n  "ignorePatterns": ["a"]\n}'
    expect(run(text).map(({ line }) => line)).toEqual([3])
  })

  it('names permissions.deny and gives no path that depends on the file', () => {
    const [message] = run('{ "ignorePatterns": [] }')
    expect(message?.message).toContain('permissions.deny')
    expect(message?.message).not.toMatch(/Read\((?:\.\/|\/)/)
  })
})

describe(`${name}: the silent cases`, () => {
  it('is silent for a permissions.deny Read rule', () => {
    expect(ids('{ "permissions": { "deny": ["Read(./secrets/**)"] } }')).toEqual([])
  })

  it('is silent for a nested key of that name', () => {
    expect(
      ids('{ "permissions": { "ignorePatterns": [] }, "env": { "ignorePatterns": "1" } }'),
    ).toEqual([])
  })

  it('is silent for an empty object and a root that is not an object', () => {
    expect(ids('{}')).toEqual([])
    expect(ids('[1]')).toEqual([])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids('{ "ignorePatterns": [] }', HIDDEN)).toEqual([])
  })
})
