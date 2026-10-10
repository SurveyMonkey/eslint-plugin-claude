// The value `auto` does not take effect from a project or local file, and it also stops Claude
// Code from reading the `defaultMode` of the user settings:
// https://code.claude.com/docs/en/permission-modes#which-mode-a-session-starts-in
// https://code.claude.com/docs/en/settings#a-value-you-set-is-ignored
// The value `bypassPermissions` is ignored there too. `permissions-bypass-mode-committed` owns it.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-default-mode-project-ignored'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const NESTED = '/repo/packages/a/.claude/settings.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const LOCAL_NAMED_DROP_IN = '/repo/managed-settings.d/settings.local.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const PROJECT_FILES = [PROJECT, LOCAL, NESTED]
const MANAGED_FILES = [MANAGED, DROP_IN, LOCAL_NAMED_DROP_IN]

const lint = (code: unknown, file = PROJECT) =>
  lintJson(name, typeof code === 'string' ? code : JSON.stringify(code), file)
const ids = (code: unknown, file = PROJECT) => lint(code, file).map((message) => message.messageId)
const mode = (defaultMode: unknown) => ({ permissions: { defaultMode } })

describe(`${name}: auto`, () => {
  it.fails('reports auto in a project or local file', () => {
    for (const file of PROJECT_FILES) {
      expect(ids(mode('auto'), file), file).toEqual(['ignored'])
    }
  })

  it.fails('says that the user defaultMode goes unread', () => {
    const [message] = lint(mode('auto'))
    expect(message?.message).toContain('built-in default')
    expect(message?.message).toContain('~/.claude/settings.json')
  })

  it.fails('reports the value, at its line and column', () => {
    const text = '{\n  "permissions": {\n    "defaultMode": "auto"\n  }\n}'
    expect(lint(text).map(({ line, column }) => [line, column])).toEqual([[3, 21]])
  })

  it.fails('is silent in a managed file, which can set auto', () => {
    for (const file of MANAGED_FILES) {
      expect(ids(mode('auto'), file), file).toEqual([])
    }
  })
})

describe(`${name}: the values that the rule leaves alone`, () => {
  it.fails('is silent for every other mode, in a project or local file', () => {
    for (const value of ['default', 'acceptEdits', 'plan', 'dontAsk', 'manual']) {
      for (const file of PROJECT_FILES) {
        expect(ids(mode(value), file), `${file} ${value}`).toEqual([])
      }
    }
  })

  it.fails('is silent for bypassPermissions: permissions-bypass-mode-committed reports it', () => {
    for (const file of PROJECT_FILES) {
      expect(ids(mode('bypassPermissions'), file), file).toEqual([])
    }
  })

  it.fails('is silent for a value that is not a mode: permissions-default-mode-value reports it', () => {
    expect(ids(mode('Auto'))).toEqual([])
    expect(ids(mode(true))).toEqual([])
    expect(ids(mode(['auto']))).toEqual([])
  })

  it.fails('is silent when defaultMode is unset or null', () => {
    expect(ids({ permissions: {} })).toEqual([])
    expect(ids(mode(null))).toEqual([])
  })

  it.fails('is silent when permissions is not an object', () => {
    expect(ids({ permissions: 'auto' })).toEqual([])
    expect(ids({ permissions: null })).toEqual([])
    expect(ids({ defaultMode: 'auto' })).toEqual([])
  })

  it.fails('is silent for a document that is not an object', () => {
    expect(ids('[1]')).toEqual([])
  })

  it.fails('reads the last of two keys of one name', () => {
    expect(ids('{"permissions": {"defaultMode": "auto", "defaultMode": "plan"}}')).toEqual([])
    expect(ids('{"permissions": {"defaultMode": "plan", "defaultMode": "auto"}}')).toEqual([
      'ignored',
    ])
  })

  it.fails('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(mode('auto'), HIDDEN)).toEqual([])
  })
})
