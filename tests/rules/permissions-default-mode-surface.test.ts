// Cloud sessions ignore `defaultMode: "dontAsk"` from a settings file. The VS Code extension never
// reads the starting mode from a project or local file
// (https://code.claude.com/docs/en/permission-modes#switch-permission-modes). `bypassPermissions`
// is for `permissions-bypass-mode-committed`, and `auto` in a project file is for
// `permissions-default-mode-project-ignored`.
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'

const name = 'permissions-default-mode-surface'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]
const PROJECT_FILES = [PROJECT, LOCAL]
const MANAGED_FILES = [MANAGED, DROP_IN]
const VSCODE = [{ vscode: true }]

function lint(code: unknown, options: unknown[] = [], file = PROJECT) {
  const text = typeof code === 'string' ? code : JSON.stringify(code)
  return new Linter({ cwd: path.parse(file).root }).verify(
    text,
    [
      {
        files: ['**/*.json'],
        plugins: { json, claude: plugin },
        language: 'json/json',
        rules: { [`claude/${name}`]: ['error', ...options] },
      },
    ],
    { filename: file },
  )
}
const ids = (code: unknown, options: unknown[] = [], file = PROJECT) =>
  lint(code, options, file).map((message) => message.messageId)
const mode = (defaultMode: unknown) => ({ permissions: { defaultMode } })

describe(`${name}: cloud sessions`, () => {
  it.fails('reports "dontAsk" in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids(mode('dontAsk'), [], file), file).toEqual(['cloud'])
    }
  })

  it.fails('names the modes that cloud sessions honor', () => {
    const [message] = lint(mode('dontAsk'))
    expect(message?.message).toContain('acceptEdits, plan, default and auto')
  })

  it.fails('reports the value, at its line and column', () => {
    const text = '{\n  "permissions": {\n    "defaultMode": "dontAsk"\n  }\n}'
    expect(lint(text).map(({ line, column }) => [line, column])).toEqual([[3, 20]])
  })

  it.fails('is silent for the modes that cloud sessions honor', () => {
    for (const value of ['plan', 'default', 'acceptEdits', 'auto']) {
      for (const file of EVERY_FILE) {
        expect(ids(mode(value), [], file), `${file} ${value}`).toEqual([])
      }
    }
  })

  it.fails('leaves "bypassPermissions" to permissions-bypass-mode-committed', () => {
    for (const file of EVERY_FILE) {
      expect(ids(mode('bypassPermissions'), [], file), file).toEqual([])
      expect(ids(mode('bypassPermissions'), VSCODE, file), file).toEqual([])
    }
  })

  it.fails('is silent for "manual", a value that is no mode, and a value of another type', () => {
    for (const value of ['manual', 'Plan', 'dontask', 1, null, ['dontAsk']]) {
      expect(ids(mode(value)), JSON.stringify(value)).toEqual([])
    }
    expect(ids({})).toEqual([])
    expect(ids({ permissions: [] })).toEqual([])
  })

  it.fails('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(mode('dontAsk'), [], HIDDEN)).toEqual([])
    expect(ids(mode('dontAsk'), VSCODE, HIDDEN)).toEqual([])
  })
})

describe(`${name}: the option vscode`, () => {
  it.fails('reports any mode in a project or local file when vscode is true', () => {
    for (const file of PROJECT_FILES) {
      for (const value of ['plan', 'default', 'acceptEdits', 'manual']) {
        expect(ids(mode(value), VSCODE, file), `${file} ${value}`).toEqual(['vscode'])
      }
    }
  })

  it.fails('reports both facts for "dontAsk" in a project file', () => {
    expect(ids(mode('dontAsk'), VSCODE)).toEqual(['cloud', 'vscode'])
  })

  it.fails('leaves "auto" in a project file to permissions-default-mode-project-ignored', () => {
    for (const file of PROJECT_FILES) {
      expect(ids(mode('auto'), VSCODE, file), file).toEqual([])
    }
  })

  it.fails('is silent in a managed file, which the extension reads', () => {
    for (const file of MANAGED_FILES) {
      expect(ids(mode('plan'), VSCODE, file), file).toEqual([])
    }
  })

  it.fails('is silent when vscode is false or unset', () => {
    for (const options of [[], [{}], [{ vscode: false }]]) {
      for (const file of PROJECT_FILES) {
        expect(ids(mode('plan'), options, file), file).toEqual([])
      }
    }
  })

  it.fails('is silent when the file sets no mode', () => {
    expect(ids({ permissions: {} }, VSCODE)).toEqual([])
    expect(ids(mode(null), VSCODE)).toEqual([])
    expect(ids(mode(1), VSCODE)).toEqual([])
  })

  it.fails('refuses an option that is not a Boolean, and an unknown option', () => {
    expect(() => lint(mode('plan'), [{ vscode: true }])).not.toThrow()
    expect(() => lint(mode('plan'), [{ vscode: 'yes' }])).toThrow()
    expect(() => lint(mode('plan'), [{ other: true }])).toThrow()
  })
})
