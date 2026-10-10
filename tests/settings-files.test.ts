// The committed settings of a `.claude/` directory: both files merged, and
// each case where a rule cannot see a file.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { readManagedSource, readSettings } from '../src/settings-files.ts'
import { UNREADABLE } from '../src/skill-tree.ts'
import { repo as repository } from './agent-settings.test-support.ts'
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

describe('readManagedSource', () => {
  const MAIN = 'managed-settings.json'
  const DROP = 'managed-settings.d'
  const at = (root: string, name: string) => path.join(root, name)
  const sorted = (value: ReturnType<typeof readManagedSource>) =>
    value === UNREADABLE
      ? value
      : [...value].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))

  it('gives an empty list when no sibling is there', () => {
    expect(readManagedSource(at(repository({}), MAIN))).toEqual([])
  })

  it('gives the drop-ins beside managed-settings.json', () => {
    const root = repository({ [`${DROP}/10-a.json`]: '{"a":1}', [`${DROP}/20-b.json`]: '{"b":2}' })
    expect(sorted(readManagedSource(at(root, MAIN)))).toEqual([{ a: 1 }, { b: 2 }])
  })

  it('does not read the linted file from the disk', () => {
    const root = repository({ [MAIN]: '{"disk":1}', [`${DROP}/10-a.json`]: '{"a":1}' })
    expect(readManagedSource(at(root, MAIN))).toEqual([{ a: 1 }])
    const other = repository({ [MAIN]: '{"m":1}', [`${DROP}/10-a.json`]: '{"disk":1}' })
    expect(readManagedSource(at(other, `${DROP}/10-a.json`))).toEqual([{ m: 1 }])
  })

  it('gives managed-settings.json and the other drop-ins for a drop-in', () => {
    const root = repository({
      [MAIN]: '{"m":1}',
      [`${DROP}/10-a.json`]: '{"a":1}',
      [`${DROP}/20-b.json`]: '{"b":2}',
    })
    expect(sorted(readManagedSource(at(root, `${DROP}/10-a.json`)))).toEqual([{ b: 2 }, { m: 1 }])
  })

  it('reads a drop-in named managed-settings.json as a drop-in', () => {
    const root = repository({ [MAIN]: '{"m":1}', [`${DROP}/${MAIN}`]: '{"d":1}' })
    expect(readManagedSource(at(root, `${DROP}/${MAIN}`))).toEqual([{ m: 1 }])
  })

  it('skips a hidden file and a file that does not end in .json', () => {
    const root = repository({
      [`${DROP}/.10-a.json`]: '{"hidden":1}',
      [`${DROP}/10-a.txt`]: '{"text":1}',
      [`${DROP}/20-b.json`]: '{"b":2}',
    })
    expect(readManagedSource(at(root, MAIN))).toEqual([{ b: 2 }])
  })

  it.each(['[1]', 'null', '1', '"x"', '{'])(
    'gives UNREADABLE for a drop-in that holds %s',
    (text) => {
      const root = repository({ [`${DROP}/10-a.json`]: text })
      expect(readManagedSource(at(root, MAIN))).toBe(UNREADABLE)
    },
  )

  it.each(['[1]', 'null', '{'])(
    'gives UNREADABLE for a managed-settings.json that holds %s',
    (text) => {
      const root = repository({ [MAIN]: text, [`${DROP}/10-a.json`]: '{}' })
      expect(readManagedSource(at(root, `${DROP}/10-a.json`))).toBe(UNREADABLE)
    },
  )

  it('gives UNREADABLE for a dangling link in the drop-in directory', () => {
    const root = repository({})
    mkdirSync(at(root, DROP))
    symlinkSync(at(root, 'gone.json'), at(root, `${DROP}/10-a.json`))
    expect(readManagedSource(at(root, MAIN))).toBe(UNREADABLE)
  })

  it('gives UNREADABLE for a dangling managed-settings.json link', () => {
    const root = repository({})
    symlinkSync(at(root, 'gone.json'), at(root, MAIN))
    expect(readManagedSource(at(root, `${DROP}/10-a.json`))).toBe(UNREADABLE)
  })

  it('gives UNREADABLE for a dangling link as the drop-in directory', () => {
    const root = repository({})
    symlinkSync(at(root, 'gone'), at(root, DROP))
    expect(readManagedSource(at(root, MAIN))).toBe(UNREADABLE)
  })

  it('gives UNREADABLE for a drop-in directory link out of the repository', () => {
    const root = repository({})
    const outside = mkdtempSync(path.join(scratch, 'outside-'))
    symlinkSync(outside, at(root, DROP))
    expect(readManagedSource(at(root, MAIN))).toBe(UNREADABLE)
  })

  it('reads a drop-in directory link inside the repository', () => {
    const root = repository({ 'real/10-a.json': '{"a":1}' })
    symlinkSync(at(root, 'real'), at(root, DROP))
    expect(readManagedSource(at(root, MAIN))).toEqual([{ a: 1 }])
  })

  it('bounds a drop-in directory link by the repository, not by the managed directory', () => {
    const root = repository({ 'pkg/managed-settings.json': '{}', 'shared/10-a.json': '{"a":1}' })
    symlinkSync(at(root, 'shared'), at(root, `pkg/${DROP}`))
    expect(readManagedSource(at(root, 'pkg/managed-settings.json'))).toEqual([{ a: 1 }])
  })

  it('gives UNREADABLE for a drop-in that links to a file out of the repository', () => {
    const root = repository({})
    const outside = mkdtempSync(path.join(scratch, 'outside-'))
    writeFileSync(path.join(outside, 'x.json'), '{"a":1}')
    mkdirSync(at(root, DROP))
    symlinkSync(path.join(outside, 'x.json'), at(root, `${DROP}/10-a.json`))
    expect(readManagedSource(at(root, MAIN))).toBe(UNREADABLE)
  })

  it('gives an empty list when managed-settings.d is a file', () => {
    const root = repository({ [DROP]: 'x' })
    expect(readManagedSource(at(root, MAIN))).toEqual([])
  })

  describe.skipIf(chmodCannotBlock)('a path that cannot be read', () => {
    it('gives UNREADABLE for a drop-in', () => {
      const root = repository({ [`${DROP}/10-a.json`]: '{}' })
      withoutAccess(at(root, `${DROP}/10-a.json`), () =>
        expect(readManagedSource(at(root, MAIN))).toBe(UNREADABLE),
      )
    })

    it('gives UNREADABLE for the drop-in directory', () => {
      const root = repository({ [`${DROP}/10-a.json`]: '{}' })
      withoutAccess(at(root, DROP), () =>
        expect(readManagedSource(at(root, MAIN))).toBe(UNREADABLE),
      )
    })

    it('gives UNREADABLE for managed-settings.json', () => {
      const root = repository({ [MAIN]: '{}' })
      withoutAccess(at(root, MAIN), () =>
        expect(readManagedSource(at(root, `${DROP}/10-a.json`))).toBe(UNREADABLE),
      )
    })
  })
})
