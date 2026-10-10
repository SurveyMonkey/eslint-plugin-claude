// `manual` is an alias for `default` that Claude Code v2.1.200 added. An older client rejects it.
// The rule reports only when the option `minVersion` is set below that version.
// `lintJson` takes no options, so this file runs the rule with a `Linter` of its own.
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'

const name = 'permissions-default-mode-manual-alias'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
// The `files` globs of the rule name these files. `tests/configs.test.ts` tests them.
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]

function lint(code: unknown, options: unknown[], file = PROJECT) {
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
const ids = (code: unknown, options: unknown[], file = PROJECT) =>
  lint(code, options, file).map((message) => message.messageId)
const mode = (defaultMode: unknown) => ({ permissions: { defaultMode } })
const BELOW = [{ minVersion: '2.1.150' }]

describe(`${name}: the report`, () => {
  it('reports "manual" when minVersion is below 2.1.200, in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids(mode('manual'), BELOW, file), file).toEqual(['alias'])
    }
  })

  it('reports for each version below 2.1.200', () => {
    for (const minVersion of ['2.1.199', '2.0.0', '1.9.9', '2.0.300', '0.0.1']) {
      expect(ids(mode('manual'), [{ minVersion }]), minVersion).toEqual(['alias'])
    }
  })

  it('names minVersion and the version in the message, and suggests "default"', () => {
    const [message] = lint(mode('manual'), BELOW)
    expect(message?.message).toContain('2.1.150')
    expect(message?.message).toContain('2.1.200')
    expect(message?.suggestions?.[0]?.fix.text).toBe('"default"')
  })

  it('reports the value, at its line and column', () => {
    const text = '{\n  "permissions": {\n    "defaultMode": "manual"\n  }\n}'
    expect(lint(text, BELOW).map(({ line, column }) => [line, column])).toEqual([[3, 20]])
  })
})

describe(`${name}: the silent cases`, () => {
  it('is silent when minVersion is unset', () => {
    for (const options of [[], [{}]]) {
      for (const file of EVERY_FILE) {
        expect(ids(mode('manual'), options, file), file).toEqual([])
      }
    }
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(mode('manual'), BELOW, HIDDEN)).toEqual([])
  })

  it('is silent when minVersion is 2.1.200 or later', () => {
    for (const minVersion of ['2.1.200', '2.1.201', '2.2.0', '3.0.0', '2.1.1000']) {
      expect(ids(mode('manual'), [{ minVersion }]), minVersion).toEqual([])
    }
  })

  it('is silent for another mode, and for a value that is not a string', () => {
    for (const value of ['default', 'plan', 'Manual', 1, null, ['manual']]) {
      expect(ids(mode(value), BELOW), JSON.stringify(value)).toEqual([])
    }
    expect(ids({}, BELOW)).toEqual([])
    expect(ids({ permissions: [] }, BELOW)).toEqual([])
  })
})

describe(`${name}: the option`, () => {
  it('refuses a minVersion that is not a version', () => {
    expect(() => lint(mode('manual'), [{ minVersion: '2.1.150' }])).not.toThrow()
    for (const minVersion of ['2.1', 'latest', '2.1.x', '', 2.1]) {
      expect(() => lint(mode('manual'), [{ minVersion }]), String(minVersion)).toThrow()
    }
    expect(() => lint(mode('manual'), [{ other: true }])).toThrow()
  })
})
