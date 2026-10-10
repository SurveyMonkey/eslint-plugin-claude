// The seven values are the list under `permissions.defaultMode` in the settings reference:
// https://code.claude.com/docs/en/settings-reference#permissionsdefaultmode
// `lintJson` runs the rule on a file at a path, so each case names the kind of file.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-default-mode-value'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]
const MANAGED_FILES = [MANAGED, DROP_IN]
const PROJECT_FILES = [PROJECT, LOCAL]
const MODES = ['default', 'acceptEdits', 'plan', 'auto', 'dontAsk', 'bypassPermissions', 'manual']

const lint = (code: unknown, file = PROJECT) =>
  lintJson(name, typeof code === 'string' ? code : JSON.stringify(code), file)
const ids = (code: unknown, file = PROJECT) => lint(code, file).map((message) => message.messageId)
const mode = (defaultMode: unknown) => ({ permissions: { defaultMode } })

describe(`${name}: the values`, () => {
  it('is silent for each of the seven modes, in every file', () => {
    for (const file of EVERY_FILE) {
      for (const value of MODES) {
        expect(ids(mode(value), file), `${file} ${value}`).toEqual([])
      }
    }
  })

  it('reports a string that is not a mode, in a project or local file', () => {
    for (const file of PROJECT_FILES) {
      for (const value of ['Plan', 'acceptedits', 'ask', 'bypass', '', 'default ']) {
        expect(ids(mode(value), file), `${file} "${value}"`).toEqual(['invalid'])
      }
    }
  })

  it('reports a value of another type', () => {
    for (const value of [true, 1, [], ['plan'], {}]) {
      expect(ids(mode(value)), JSON.stringify(value)).toEqual(['invalid'])
    }
  })

  it('names the modes in the message', () => {
    const [message] = lint(mode('ask'))
    expect(message?.message).toContain(
      'default, acceptEdits, plan, auto, dontAsk, bypassPermissions, manual',
    )
  })

  it('reports the value, at its line and column', () => {
    const text = '{\n  "permissions": {\n    "defaultMode": "ask"\n  }\n}'
    expect(lint(text).map(({ line, column }) => [line, column])).toEqual([[3, 20]])
  })
})

describe(`${name}: a managed file`, () => {
  it('reports a bad value with the message for managed settings', () => {
    for (const file of MANAGED_FILES) {
      expect(ids(mode('ask'), file), file).toEqual(['invalidManaged'])
      expect(ids(mode(true), file), file).toEqual(['invalidManaged'])
    }
  })

  it('says that Claude Code reads the value as default', () => {
    const [message] = lint(mode('ask'), MANAGED)
    expect(message?.message).toContain('reads it as "default"')
  })
})

describe(`${name}: what the rule leaves alone`, () => {
  it('is silent when defaultMode is unset or null', () => {
    expect(ids({ permissions: {} })).toEqual([])
    expect(ids(mode(null))).toEqual([])
    expect(ids({ permissions: { allow: ['Bash'] } })).toEqual([])
  })

  it('is silent when permissions is not an object', () => {
    expect(ids({ permissions: 'plan' })).toEqual([])
    expect(ids({ permissions: ['defaultMode'] })).toEqual([])
    expect(ids({ permissions: null })).toEqual([])
    expect(ids({})).toEqual([])
  })

  it('is silent for a defaultMode at the top level', () => {
    expect(ids({ defaultMode: 'ask' })).toEqual([])
  })

  it('is silent for a document that is not an object', () => {
    expect(ids('[1]')).toEqual([])
    expect(ids('"x"')).toEqual([])
  })

  it('reads the last of two keys of one name', () => {
    const early = '{"permissions": {"defaultMode": "ask", "defaultMode": "plan"}}'
    const late = '{"permissions": {"defaultMode": "plan", "defaultMode": "ask"}}'
    expect(ids(early)).toEqual([])
    expect(ids(late)).toEqual(['invalid'])
    const twice = '{"permissions": {"defaultMode": "ask"}, "permissions": {}}'
    expect(ids(twice)).toEqual([])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(mode('ask'), HIDDEN)).toEqual([])
  })
})
