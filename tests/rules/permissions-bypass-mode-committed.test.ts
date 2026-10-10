// `defaultMode: "bypassPermissions"` in a committed file. Claude Code ignores it in a project or
// local file since v2.1.257, and allow rules have no effect in the mode:
// https://code.claude.com/docs/en/settings-reference#permissionsdefaultmode
// https://code.claude.com/docs/en/permission-modes#skip-all-checks-with-bypasspermissions-mode
// https://code.claude.com/docs/en/permission-modes#available-modes
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-bypass-mode-committed'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const MANAGED_FILES = [MANAGED, DROP_IN]
const PROJECT_FILES = [PROJECT, LOCAL]
const BYPASS = 'bypassPermissions'

const lint = (code: unknown, file = PROJECT) =>
  lintJson(name, typeof code === 'string' ? code : JSON.stringify(code), file)
const ids = (code: unknown, file = PROJECT) => lint(code, file).map((message) => message.messageId)
const mode = (defaultMode: unknown, more: object = {}) => ({
  permissions: { defaultMode, ...more },
})

describe(`${name}: the value`, () => {
  it.fails('reports bypassPermissions in a project or local file, with the message for that file', () => {
    for (const file of PROJECT_FILES) {
      expect(ids(mode(BYPASS), file), file).toEqual(['project'])
    }
  })

  it.fails('reports bypassPermissions in a managed file, with the message for managed settings', () => {
    for (const file of MANAGED_FILES) {
      expect(ids(mode(BYPASS), file), file).toEqual(['managed'])
    }
  })

  it.fails('says that a current client ignores the value and an older client honors it', () => {
    const [message] = lint(mode(BYPASS))
    expect(message?.message).toContain('v2.1.257')
    expect(message?.message).toContain('Manual')
  })

  it.fails('says that the value skips every prompt, and that deny rules still apply', () => {
    const [message] = lint(mode(BYPASS), MANAGED)
    expect(message?.message).toContain('without a prompt')
    expect(message?.message).toContain('Deny rules')
  })

  it.fails('reports the value, at its line and column', () => {
    const text = '{\n  "permissions": {\n    "defaultMode": "bypassPermissions"\n  }\n}'
    expect(lint(text).map(({ line, column }) => [line, column])).toEqual([[3, 21]])
  })

  it.fails('is silent for every other value', () => {
    for (const value of ['default', 'acceptEdits', 'plan', 'auto', 'dontAsk', 'manual']) {
      expect(ids(mode(value)), value).toEqual([])
      expect(ids(mode(value), MANAGED), value).toEqual([])
    }
    expect(ids(mode('bypasspermissions'))).toEqual([])
    expect(ids(mode(true))).toEqual([])
    expect(ids(mode([BYPASS]))).toEqual([])
  })
})

describe(`${name}: the allow rules of the file`, () => {
  const note = 'The allow rules of this file have no effect in that mode.'

  it.fails('adds that the allow rules have no effect, in every kind of file', () => {
    for (const file of [...PROJECT_FILES, ...MANAGED_FILES]) {
      const [message] = lint(mode(BYPASS, { allow: ['Bash(npm test)'] }), file)
      expect(message?.message, file).toContain(note)
    }
  })

  it.fails('adds no note for an empty allow list, a missing list, a null or a value that is no list', () => {
    for (const allow of [[], null, 'Bash', {}]) {
      const [message] = lint(mode(BYPASS, { allow }))
      expect(message?.message, JSON.stringify(allow)).not.toContain('allow rules')
    }
    expect(lint(mode(BYPASS))[0]?.message).not.toContain('allow rules')
  })

  it.fails('makes one report whatever the allow rules are', () => {
    expect(ids(mode(BYPASS, { allow: ['Bash', 'Read', 3], deny: ['Bash(rm *)'] }))).toEqual([
      'project',
    ])
  })
})

describe(`${name}: a lock in the same file`, () => {
  it.fails('is silent when disableBypassPermissionsMode is disable: permissions-default-mode-conflict reports it', () => {
    for (const file of [...PROJECT_FILES, ...MANAGED_FILES]) {
      const code = mode(BYPASS, { disableBypassPermissionsMode: 'disable' })
      expect(ids(code, file), file).toEqual([])
    }
  })

  it.fails('reports when the lock is another value, null or unset', () => {
    expect(ids(mode(BYPASS, { disableBypassPermissionsMode: true }))).toEqual(['project'])
    expect(ids(mode(BYPASS, { disableBypassPermissionsMode: null }))).toEqual(['project'])
    expect(ids(mode(BYPASS, { disableAutoMode: 'disable' }))).toEqual(['project'])
  })
})

describe(`${name}: what the rule leaves alone`, () => {
  it.fails('is silent when defaultMode is unset or null', () => {
    expect(ids({ permissions: {} })).toEqual([])
    expect(ids(mode(null))).toEqual([])
  })

  it.fails('is silent when permissions is not an object', () => {
    expect(ids({ permissions: BYPASS })).toEqual([])
    expect(ids({ permissions: null })).toEqual([])
    expect(ids({ defaultMode: BYPASS })).toEqual([])
  })

  it.fails('is silent for a document that is not an object', () => {
    expect(ids('[1]')).toEqual([])
  })

  it.fails('reads the last of two keys of one name', () => {
    expect(ids(`{"permissions": {"defaultMode": "${BYPASS}", "defaultMode": "plan"}}`)).toEqual([])
    expect(ids(`{"permissions": {"defaultMode": "plan", "defaultMode": "${BYPASS}"}}`)).toEqual([
      'project',
    ])
    const lock = `{"permissions": {"defaultMode": "${BYPASS}", "disableBypassPermissionsMode": "disable", "disableBypassPermissionsMode": "x"}}`
    expect(ids(lock)).toEqual(['project'])
  })

  it.fails('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(mode(BYPASS), HIDDEN)).toEqual([])
  })
})
