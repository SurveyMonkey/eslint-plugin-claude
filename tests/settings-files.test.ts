// The committed settings of a `.claude/` directory: both files merged, and
// each case where a rule cannot see a file.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { readSettings } from '../src/settings-files.ts'
import { UNREADABLE } from '../src/skill-tree.ts'
import { chmodCannotBlock, withoutAccess } from './rule-tester.test-support.ts'

// The real path, so that a bound compares equal on a system where the
// temporary directory is a link (macOS).
const scratch = realpathSync(mkdtempSync(path.join(tmpdir(), 'settings-files-')))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

let count = 0
/** A fresh repository bound with a `.claude/` directory that holds `files`. */
const repo = (files: Record<string, string>) => {
  const bound = path.join(scratch, `repo${count++}`)
  const dir = path.join(bound, '.claude')
  mkdirSync(dir, { recursive: true })
  for (const [name, text] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), text)
  }
  return { bound, dir }
}

describe('readSettings', () => {
  it('gives null when neither file is there', () => {
    const { bound, dir } = repo({})
    expect(readSettings(dir, bound)).toBeNull()
  })

  it('gives null when the directory is not there', () => {
    expect(readSettings(path.join(scratch, 'none', '.claude'), scratch)).toBeNull()
  })

  it('gives the fields of the project file alone', () => {
    const { bound, dir } = repo({ 'settings.json': '{"model":"a"}' })
    expect(readSettings(dir, bound)).toEqual({ model: 'a' })
  })

  it('gives the fields of the local file alone', () => {
    const { bound, dir } = repo({ 'settings.local.json': '{"model":"b"}' })
    expect(readSettings(dir, bound)).toEqual({ model: 'b' })
  })

  it('merges both files, and the local file wins for one key', () => {
    const { bound, dir } = repo({
      'settings.json': '{"model":"a","theme":"dark"}',
      'settings.local.json': '{"model":"b","effort":"high"}',
    })
    expect(readSettings(dir, bound)).toEqual({ model: 'b', theme: 'dark', effort: 'high' })
  })

  it('replaces a nested object as a whole, but merges the env objects by key', () => {
    const { bound, dir } = repo({
      'settings.json': '{"permissions":{"allow":["A"]},"env":{"X":"1","Y":"2"}}',
      'settings.local.json': '{"permissions":{"deny":["B"]},"env":{"Y":"3"}}',
    })
    expect(readSettings(dir, bound)).toEqual({
      permissions: { deny: ['B'] },
      env: { X: '1', Y: '3' },
    })
  })

  it('lets a local env replace the project env when one of them is not an object', () => {
    const one = repo({ 'settings.json': '{"env":{"X":"1"}}', 'settings.local.json': '{"env":5}' })
    expect(readSettings(one.dir, one.bound)).toEqual({ env: 5 })
    const two = repo({ 'settings.json': '{"env":[1]}', 'settings.local.json': '{"env":{"X":"1"}}' })
    expect(readSettings(two.dir, two.bound)).toEqual({ env: { X: '1' } })
    const three = repo({
      'settings.json': '{"env":null}',
      'settings.local.json': '{"env":{"X":"1"}}',
    })
    expect(readSettings(three.dir, three.bound)).toEqual({ env: { X: '1' } })
  })

  it('gives UNREADABLE for a file that does not parse, in either file', () => {
    const bad = repo({ 'settings.json': '{"model":' })
    expect(readSettings(bad.dir, bad.bound)).toBe(UNREADABLE)
    const local = repo({ 'settings.json': '{}', 'settings.local.json': '{"a":1,}' })
    expect(readSettings(local.dir, local.bound)).toBe(UNREADABLE)
  })

  it.each(['[]', 'null', '5', '"x"'])('gives UNREADABLE for the JSON root %s', (root) => {
    const { bound, dir } = repo({ 'settings.json': '{}', 'settings.local.json': root })
    expect(readSettings(dir, bound)).toBe(UNREADABLE)
    const first = repo({ 'settings.json': root })
    expect(readSettings(first.dir, first.bound)).toBe(UNREADABLE)
  })

  it('gives UNREADABLE for a link out of the bound, even when the other file is good', () => {
    const outside = path.join(scratch, 'outside.json')
    writeFileSync(outside, '{"model":"x"}')
    const { bound, dir } = repo({ 'settings.json': '{"model":"a"}' })
    symlinkSync(outside, path.join(dir, 'settings.local.json'))
    expect(readSettings(dir, bound)).toBe(UNREADABLE)
  })

  it('gives UNREADABLE for a dangling link', () => {
    const { bound, dir } = repo({ 'settings.json': '{}' })
    symlinkSync(path.join(bound, 'missing.json'), path.join(dir, 'settings.local.json'))
    expect(readSettings(dir, bound)).toBe(UNREADABLE)
  })

  it('reads a link to a file inside the bound', () => {
    const { bound, dir } = repo({})
    writeFileSync(path.join(bound, 'shared.json'), '{"model":"l"}')
    symlinkSync(path.join(bound, 'shared.json'), path.join(dir, 'settings.json'))
    expect(readSettings(dir, bound)).toEqual({ model: 'l' })
  })

  describe.skipIf(chmodCannotBlock)('a file that cannot be read', () => {
    it('gives UNREADABLE for the local file, and the project file is good', () => {
      const { bound, dir } = repo({ 'settings.json': '{"model":"a"}', 'settings.local.json': '{}' })
      withoutAccess(path.join(dir, 'settings.local.json'), () =>
        expect(readSettings(dir, bound)).toBe(UNREADABLE),
      )
      expect(readSettings(dir, bound)).toEqual({ model: 'a' })
    })

    it('gives UNREADABLE for the project file, and the local file is good', () => {
      const { bound, dir } = repo({ 'settings.json': '{}', 'settings.local.json': '{"a":1}' })
      withoutAccess(path.join(dir, 'settings.json'), () =>
        expect(readSettings(dir, bound)).toBe(UNREADABLE),
      )
    })
  })
})
