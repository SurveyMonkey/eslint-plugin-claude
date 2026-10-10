// The expected values come from the settings reference
// (https://code.claude.com/docs/en/settings-reference#maxeffortlevel): `maxEffortLevel` caps the
// level, "Deploy it in managed settings to enforce it for an organization", and a value of `"max"`
// sets no cap. `effortLevel` sets a default only
// (https://code.claude.com/docs/en/settings-reference#effortlevel). The managed settings page
// merges `managed-settings.json` and `managed-settings.d/*.json` into one source
// (https://code.claude.com/docs/en/managed-settings#split-a-file-based-policy-across-teams), so
// each case builds a tree on disk. The file globs are in `tests/configs.test.ts`.
import { chmodSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { chmodCannotBlock, lintJson, withoutAccess } from '../rule-tester.test-support.ts'

const name = 'settings-managed-effort-cap'
const MANAGED = 'managed-settings.json'
const DROP_IN = 'managed-settings.d/20-b.json'
const LEVEL = JSON.stringify({ effortLevel: 'high' })
const CAP = JSON.stringify({ maxEffortLevel: 'medium' })

const ids = (dir: string, file: string, code = LEVEL) =>
  lintJson(name, code, path.join(dir, file)).map((m) => m.messageId)

describe('settings-managed-effort-cap: the linted file', () => {
  it('reports effortLevel without maxEffortLevel, in both managed file kinds, on the value', () => {
    for (const file of [MANAGED, DROP_IN]) {
      expect(ids(tree({}), file), file).toEqual(['uncapped'])
    }
    const [message] = lintJson(name, '{\n  "effortLevel": "xhigh"\n}', path.join(tree({}), MANAGED))
    expect([message?.line, message?.column]).toEqual([2, 18])
  })

  it('is silent when the file sets maxEffortLevel, with any level', () => {
    for (const level of ['low', 'medium', 'high', 'xhigh', 'max']) {
      const code = JSON.stringify({ effortLevel: 'high', maxEffortLevel: level })
      expect(ids(tree({}), MANAGED, code), level).toEqual([])
    }
  })

  it('reports a maxEffortLevel that is not a string, as no cap', () => {
    for (const cap of [null, 1, true, ['low']]) {
      const code = JSON.stringify({ effortLevel: 'high', maxEffortLevel: cap })
      expect(ids(tree({}), MANAGED, code), JSON.stringify(cap)).toEqual(['uncapped'])
    }
  })

  it('is silent when effortLevel is unset or not a string', () => {
    for (const code of ['{}', CAP, '{"effortLevel": null}', '{"effortLevel": 5}']) {
      expect(ids(tree({}), MANAGED, code), code).toEqual([])
    }
  })

  it('reads the last of two keys of one name', () => {
    const twice = (a: string, b: string) => `{"effortLevel": "${a}", "effortLevel": "${b}"}`
    expect(ids(tree({}), MANAGED, twice('high', 'high'))).toEqual(['uncapped'])
    expect(
      ids(
        tree({}),
        MANAGED,
        '{"effortLevel": "high", "maxEffortLevel": "low", "maxEffortLevel": null}',
      ),
    ).toEqual(['uncapped'])
  })

  it('reads no hidden drop-in', () => {
    expect(ids(tree({}), 'managed-settings.d/.30-hidden.json')).toEqual([])
  })
})

describe('settings-managed-effort-cap: the managed source', () => {
  it('is silent when another file of the source sets maxEffortLevel', () => {
    expect(ids(tree({ [DROP_IN]: CAP }), MANAGED)).toEqual([])
    expect(ids(tree({ [MANAGED]: CAP }), DROP_IN)).toEqual([])
    expect(ids(tree({ [MANAGED]: LEVEL, 'managed-settings.d/30-c.json': CAP }), DROP_IN)).toEqual(
      [],
    )
  })

  it('reports when the other files set no cap', () => {
    const others = {
      [MANAGED]: '{"permissions": {"allow": []}}',
      'managed-settings.d/10-a.json': '{"maxEffortLevel": null}',
      'managed-settings.d/.30-hidden.json': CAP,
      'managed-settings.d/40-d.txt': CAP,
    }
    expect(ids(tree(others), DROP_IN)).toEqual(['uncapped'])
  })

  it('is silent when a file of the source cannot be read', () => {
    expect(ids(tree({ [MANAGED]: '{' }), DROP_IN)).toEqual([])
    expect(ids(tree({ [DROP_IN]: '[]' }), MANAGED)).toEqual([])
    expect(ids(tree({ 'managed-settings.d/30-c.json': '' }), MANAGED)).toEqual([])
  })

  it.skipIf(noLinks)('is silent when a file of the source is a link out of the repository', () => {
    // The outside file holds no cap, so a read of it would give a report.
    const outside = tree({ 'cap.json': '{}' }, false)
    const dir = tree({})
    link(dir, 'managed-settings.d/30-c.json', path.join(outside, 'cap.json'))
    expect(ids(dir, MANAGED)).toEqual([])
  })

  it.skipIf(chmodCannotBlock)('is silent when a file of the source has no read access', () => {
    const dir = tree({ [DROP_IN]: '{}' })
    withoutAccess(path.join(dir, DROP_IN), () => {
      expect(ids(dir, MANAGED)).toEqual([])
    })
    chmodSync(path.join(dir, DROP_IN), 0o644)
  })
})
