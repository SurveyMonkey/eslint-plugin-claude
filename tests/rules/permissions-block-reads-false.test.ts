// The settings reference, `permissions.blockReadsOutsideWorkingDirectories`: "A `true` in any file
// applies, so a repository can turn the block on for itself but can't lift yours." `false` is "the
// same as unset; the block still applies if another file sets `true`":
// https://code.claude.com/docs/en/settings-reference#permissions-blockreadsoutsideworkingdirectories
// A value that is not a Boolean is for `permissions-schema`.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-block-reads-false'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const NESTED = '/repo/packages/a/.claude/settings.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const PROJECT_FILES = [PROJECT, LOCAL, NESTED]
const MANAGED_FILES = [MANAGED, DROP_IN]

const lint = (code: unknown, file = PROJECT) =>
  lintJson(name, typeof code === 'string' ? code : JSON.stringify(code), file)
const ids = (code: unknown, file = PROJECT) => lint(code, file).map((message) => message.messageId)
const block = (value: unknown) => ({ permissions: { blockReadsOutsideWorkingDirectories: value } })

describe(`${name}: the reports`, () => {
  it('reports false in a project, local or managed file', () => {
    for (const file of [...PROJECT_FILES, ...MANAGED_FILES]) {
      expect(ids(block(false), file), file).toEqual(['sameAsUnset'])
    }
  })

  it('says that false is the same as unset, and cannot lift a true', () => {
    const [message] = lint(block(false))
    expect(message?.message).toContain('same as unset')
    expect(message?.message).toContain('`true`')
    expect(message?.message).toContain('another file')
  })

  it('reports the value, at its line, column and end', () => {
    const [message, ...rest] = lint('{"permissions":{"blockReadsOutsideWorkingDirectories":false}}')
    expect(rest).toEqual([])
    expect([message?.line, message?.column, message?.endLine, message?.endColumn]).toEqual([
      1, 55, 1, 60,
    ])
  })

  it('reads the last of two keys, as JSON.parse does', () => {
    expect(
      ids(
        '{"permissions":{"blockReadsOutsideWorkingDirectories":true,"blockReadsOutsideWorkingDirectories":false}}',
      ),
    ).toEqual(['sameAsUnset'])
    expect(
      ids(
        '{"permissions":{"blockReadsOutsideWorkingDirectories":false,"blockReadsOutsideWorkingDirectories":true}}',
      ),
    ).toEqual([])
  })
})

describe(`${name}: the values that it leaves alone`, () => {
  it('is silent for true, which turns the block on', () => {
    for (const file of [...PROJECT_FILES, ...MANAGED_FILES]) {
      expect(ids(block(true), file), file).toEqual([])
    }
  })

  it('is silent for a value that is not a Boolean, which permissions-schema reads', () => {
    for (const value of ['false', 0, null, [], {}, 'yes']) {
      expect(ids(block(value)), JSON.stringify(value)).toEqual([])
    }
  })

  it('is silent when the key is missing or sits outside permissions', () => {
    expect(ids({ permissions: { allow: [] } })).toEqual([])
    expect(ids({ permissions: 'x' })).toEqual([])
    expect(ids({ blockReadsOutsideWorkingDirectories: false })).toEqual([])
    expect(
      ids({ permissions: { sandbox: { blockReadsOutsideWorkingDirectories: false } } }),
    ).toEqual([])
    expect(ids('[]')).toEqual([])
  })

  it('is silent for a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(block(false), HIDDEN)).toEqual([])
  })
})
