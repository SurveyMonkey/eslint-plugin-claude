// The expected values come from the model configuration page
// (https://code.claude.com/docs/en/model-config#block-specific-models-or-versions):
// `deniedModels` and `availableModelsMatch` "both require Claude Code v2.1.283 or later", and
// "earlier versions ignore both keys, so also set `requiredMinimumVersion` to keep those versions
// from starting". The rule reads the linted file and the files of the same managed source, so
// each case builds a tree on disk. The files glob is in `tests/configs.test.ts`.
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'settings-managed-version-floor'
const MANAGED = 'managed-settings.json'
const DROP_IN = 'managed-settings.d/20-b.json'
const A = 'managed-settings.d/10-a.json'

const DENIED = JSON.stringify({ deniedModels: ['claude-opus-5-5'] })
const EXACT = JSON.stringify({ availableModelsMatch: 'exact' })
const floor = (version: unknown, extra: object = { deniedModels: ['claude-opus-5-5'] }) =>
  JSON.stringify({ ...extra, requiredMinimumVersion: version })

/** The messages of the rule for the text `code` at `file` in the tree `dir`. */
const lint = (dir: string, file: string, code = DENIED) =>
  lintJson(name, code, path.join(dir, file))
const ids = (dir: string, file: string, code = DENIED) =>
  lint(dir, file, code).map((m) => m.messageId)

describe(`${name}: the linted file`, () => {
  it('reports deniedModels without a floor, in a managed file and a drop-in', () => {
    for (const file of [MANAGED, DROP_IN]) {
      expect(ids(tree({}), file), file).toEqual(['floor'])
    }
  })

  it('reports on the key, and names it', () => {
    const [message] = lint(tree({}), MANAGED, '{\n  "deniedModels": ["x"]\n}')
    expect([message?.line, message?.column]).toEqual([2, 3])
    expect(message?.message).toBe(
      'Claude Code before v2.1.283 ignores "deniedModels". The managed settings do not set "requiredMinimumVersion" to 2.1.283 or later, so those versions still start.',
    )
  })

  it('reports availableModelsMatch "exact" without a floor', () => {
    expect(ids(tree({}), MANAGED, EXACT)).toEqual(['floor'])
    const both = JSON.stringify({ deniedModels: ['a'], availableModelsMatch: 'exact' })
    expect(ids(tree({}), MANAGED, both)).toEqual(['floor', 'floor'])
  })

  it('reports a floor below 2.1.283', () => {
    for (const version of ['2.1.282', '2.1.0', '2.0.999', '1.9.9999', '2.1.9', '0.0.0']) {
      expect(ids(tree({}), MANAGED, floor(version)), version).toEqual(['floor'])
    }
  })

  it('is silent for a floor of 2.1.283 or later', () => {
    for (const version of [
      '2.1.283',
      '2.1.284',
      '2.1.1000',
      '2.2.0',
      '2.2.1',
      '3.0.0',
      '10.0.0',
      '2.1.283-rc1',
      '2.1.283+build',
    ]) {
      expect(ids(tree({}), MANAGED, floor(version)), version).toEqual([])
    }
    expect(ids(tree({}), MANAGED, floor('2.1.283', { availableModelsMatch: 'exact' }))).toEqual([])
  })

  it('is silent for a floor that is not a version number, because the rule cannot tell', () => {
    for (const version of [
      'latest',
      '',
      '2.1',
      'v2.1.283',
      2.1,
      283,
      true,
      ['2.1.283'],
      { v: '2.1.283' },
    ]) {
      expect(ids(tree({}), MANAGED, floor(version)), JSON.stringify(version)).toEqual([])
    }
  })

  it('is silent when a file of the source has a floor that is not a version number', () => {
    for (const version of [2.1, true, 'latest', ['2.1.283']]) {
      const sibling = tree({ [A]: floor(version, {}) })
      expect(ids(sibling, MANAGED), JSON.stringify(version)).toEqual([])
    }
  })

  it('reports a floor of null, which removes the key', () => {
    expect(ids(tree({}), MANAGED, floor(null))).toEqual(['floor'])
  })

  it('reads the last of two keys of one name', () => {
    const twice = (first: string, second: string) =>
      `{"deniedModels":["x"],"requiredMinimumVersion":"${first}","requiredMinimumVersion":"${second}"}`
    expect(ids(tree({}), MANAGED, twice('2.1.283', '2.1.282'))).toEqual(['floor'])
    expect(ids(tree({}), MANAGED, twice('2.1.282', '2.1.283'))).toEqual([])
    const lists = '{"deniedModels":["x"],"deniedModels":[],"availableModelsMatch":"prefix"}'
    expect(ids(tree({}), MANAGED, lists)).toEqual([])
  })

  it('is silent when no key needs the floor', () => {
    for (const code of [
      '{}',
      '{"deniedModels": []}',
      '{"deniedModels": null}',
      '{"deniedModels": "claude-opus-5-5"}',
      '{"deniedModels": {"a": 1}}',
      '{"availableModelsMatch": "prefix"}',
      '{"availableModelsMatch": "Exact"}',
      '{"availableModelsMatch": true}',
      '{"availableModelsMatch": null}',
      '{"availableModels": ["opus"]}',
      '[]',
    ]) {
      expect(ids(tree({}), MANAGED, code), code).toEqual([])
    }
  })

  it('is silent for a hidden drop-in', () => {
    expect(ids(tree({}), 'managed-settings.d/.20-b.json')).toEqual([])
  })
})

describe(`${name}: the managed source`, () => {
  it('is silent when another file of the source sets a floor of 2.1.283 or later', () => {
    expect(ids(tree({ [DROP_IN]: floor('2.1.283', {}) }), MANAGED)).toEqual([])
    expect(ids(tree({ [MANAGED]: floor('2.1.283', {}) }), DROP_IN)).toEqual([])
    expect(ids(tree({ [A]: floor('2.1.283', {}) }), DROP_IN)).toEqual([])
  })

  it('is silent when any one of several files sets the floor, and not every file', () => {
    // The merge order of the drop-ins is not in view, so one floor of 2.1.283 or later is enough.
    const low = floor('2.1.282', {})
    expect(
      ids(tree({ [MANAGED]: low, [A]: floor('2.1.283', {}), [DROP_IN]: low }), MANAGED),
    ).toEqual([])
    expect(ids(tree({ [MANAGED]: floor('2.1.283', {}), [A]: low }), DROP_IN)).toEqual([])
    expect(ids(tree({ [MANAGED]: low, [A]: floor('3.0.0', {}) }), DROP_IN)).toEqual([])
    // The linted file sets the floor, and a sibling sets a lower one.
    expect(ids(tree({ [A]: low }), DROP_IN, floor('2.1.283'))).toEqual([])
  })

  it('reports when every file sets a floor below 2.1.283, or none sets one', () => {
    const low = floor('2.1.282', {})
    expect(ids(tree({ [MANAGED]: low, [A]: low }), DROP_IN)).toEqual(['floor'])
    expect(ids(tree({ [MANAGED]: '{}', [A]: '{"model": "opus"}' }), DROP_IN)).toEqual(['floor'])
    expect(ids(tree({ [A]: floor(null, {}) }), DROP_IN)).toEqual(['floor'])
  })

  it('reports in each file that holds a key', () => {
    const files = { [MANAGED]: DENIED, [A]: EXACT }
    expect(ids(tree(files), MANAGED)).toEqual(['floor'])
    expect(ids(tree(files), A)).toEqual(['floor'])
  })

  it('does not read a hidden drop-in, a file that is not .json, or a project file', () => {
    const floorFile = floor('2.1.283', {})
    const sources = {
      'managed-settings.d/.10-a.json': floorFile,
      'managed-settings.d/10-b.txt': floorFile,
      '.claude/settings.json': floorFile,
      '.claude/settings.local.json': floorFile,
    }
    expect(ids(tree(sources), MANAGED)).toEqual(['floor'])
  })

  it('makes no report when a file of the source cannot be seen', () => {
    for (const text of ['[]', 'null', '{"requiredMinimumVersion": ', '']) {
      expect(ids(tree({ [DROP_IN]: text }), MANAGED), text).toEqual([])
    }
    const dir = tree({})
    mkdirSync(path.join(dir, A), { recursive: true })
    expect(ids(dir, MANAGED)).toEqual([])
  })

  it.skipIf(noLinks)('makes no report for a link that leads out of the repository', () => {
    // The directory holds a file with no floor. A read that left the bound would report.
    const outside = tree({ 'managed-settings.d/10-a.json': '{}' }, false)
    const dir = tree({})
    link(dir, 'managed-settings.d', path.join(outside, 'managed-settings.d'))
    expect(ids(dir, MANAGED)).toEqual([])
    const dangling = tree({})
    link(dangling, 'managed-settings.d', 'missing')
    expect(ids(dangling, MANAGED)).toEqual([])
    const file = tree({})
    link(file, A, 'missing.json')
    expect(ids(file, MANAGED)).toEqual([])
  })
})
