// The lock keys take the string "disable", as the entries of the settings reference show:
// https://code.claude.com/docs/en/settings-reference#permissionsdisablebypasspermissionsmode
// https://code.claude.com/docs/en/settings-reference#disableautomode
// In managed settings a lock with a bad value reads as "disable":
// https://code.claude.com/docs/en/managed-settings#keys-that-fail-closed
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-disable-mode-value'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]
const MANAGED_FILES = [MANAGED, DROP_IN]
const PROJECT_FILES = [PROJECT, LOCAL]

const lint = (code: unknown, file = PROJECT) =>
  lintJson(name, typeof code === 'string' ? code : JSON.stringify(code), file)
const ids = (code: unknown, file = PROJECT) => lint(code, file).map((message) => message.messageId)

/** One document for each place that holds a lock, with the value `value`. */
const PLACES: Record<string, (value: unknown) => unknown> = {
  'permissions.disableBypassPermissionsMode': (value) => ({
    permissions: { disableBypassPermissionsMode: value },
  }),
  'permissions.disableAutoMode': (value) => ({ permissions: { disableAutoMode: value } }),
  disableAutoMode: (value) => ({ disableAutoMode: value }),
}

describe(`${name}: the three places`, () => {
  it.fails('is silent for the string "disable", in every file', () => {
    for (const file of EVERY_FILE) {
      for (const [place, at] of Object.entries(PLACES)) {
        expect(ids(at('disable'), file), `${file} ${place}`).toEqual([])
      }
    }
  })

  it.fails('reports any other value, in a project or local file', () => {
    for (const file of PROJECT_FILES) {
      for (const [place, at] of Object.entries(PLACES)) {
        for (const value of [true, false, 1, 'enable', 'Disable', 'disable ', '', [], {}]) {
          expect(ids(at(value), file), `${file} ${place} ${JSON.stringify(value)}`).toEqual([
            'invalid',
          ])
        }
      }
    }
  })

  it.fails('names the key in the message', () => {
    for (const [place, at] of Object.entries(PLACES)) {
      const [message] = lint(at(true))
      expect(message?.message, place).toContain(`"${place}"`)
    }
  })

  it.fails('reports each place once', () => {
    const code = {
      disableAutoMode: true,
      permissions: { disableAutoMode: 'x', disableBypassPermissionsMode: false },
    }
    expect(ids(code)).toEqual(['invalid', 'invalid', 'invalid'])
  })

  it.fails('reports the value, at its line and column', () => {
    const text = '{\n  "permissions": {\n    "disableBypassPermissionsMode": true\n  }\n}'
    expect(lint(text).map(({ line, column }) => [line, column])).toEqual([[3, 38]])
  })
})

describe(`${name}: a managed file`, () => {
  it.fails('reports a bad value with the message for managed settings', () => {
    for (const file of MANAGED_FILES) {
      for (const [place, at] of Object.entries(PLACES)) {
        expect(ids(at(true), file), `${file} ${place}`).toEqual(['invalidManaged'])
      }
    }
  })

  it.fails('says that Claude Code reads the value as disable', () => {
    const [message] = lint(PLACES.disableAutoMode?.(true), MANAGED)
    expect(message?.message).toContain('reads any other value as "disable"')
  })
})

describe(`${name}: what the rule leaves alone`, () => {
  it.fails('is silent when a key is unset or null', () => {
    expect(ids({})).toEqual([])
    expect(ids({ permissions: {} })).toEqual([])
    for (const at of Object.values(PLACES)) {
      expect(ids(at(null))).toEqual([])
    }
  })

  it.fails('is silent when permissions is not an object', () => {
    expect(ids({ permissions: true })).toEqual([])
    expect(ids({ permissions: [] })).toEqual([])
    expect(ids({ permissions: null })).toEqual([])
  })

  it.fails('is silent for disableBypassPermissionsMode at the top level: it is no key there', () => {
    expect(ids({ disableBypassPermissionsMode: true })).toEqual([])
  })

  it.fails('is silent for a document that is not an object', () => {
    expect(ids('[1]')).toEqual([])
    expect(ids('"x"')).toEqual([])
  })

  it.fails('reads the last of two keys of one name', () => {
    expect(ids('{"disableAutoMode": true, "disableAutoMode": "disable"}')).toEqual([])
    expect(ids('{"disableAutoMode": "disable", "disableAutoMode": true}')).toEqual(['invalid'])
    const twice = '{"permissions": {"disableAutoMode": true}, "permissions": {}}'
    expect(ids(twice)).toEqual([])
  })

  it.fails('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids({ disableAutoMode: true }, HIDDEN)).toEqual([])
  })
})
