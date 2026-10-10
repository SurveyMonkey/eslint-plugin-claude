// The expected values come from the settings reference
// (https://code.claude.com/docs/en/settings-reference#skipwebfetchpreflight): with the check
// skipped, WebFetch attempts any URL without the blocklist, so the key goes with `WebFetch`
// permission rules. The rule reads the linted file and the files that Claude Code merges with it,
// so each case builds a tree on disk. The file globs are in `tests/configs.test.ts`.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const MANAGED = 'managed-settings.json'
const DROP_IN = 'managed-settings.d/20-b.json'
const SKIP = JSON.stringify({ skipWebFetchPreflight: true })
const RULES = (...entries: unknown[]) => JSON.stringify({ permissions: { allow: entries } })
const FETCH = 'WebFetch(domain:docs.example.com)'

/** The ids of the rule for the text `code` at `file` in the tree `dir`. */
const ids = (dir: string, file: string, code = SKIP) =>
  lintJson('settings-webfetch-preflight-skip', code, path.join(dir, file)).map((m) => m.messageId)

describe('settings-webfetch-preflight-skip: the linted file', () => {
  it('reports the key in every settings file, on the value', () => {
    for (const file of [PROJECT, LOCAL, MANAGED, DROP_IN]) {
      expect(ids(tree({}), file), file).toEqual(['skipped'])
    }
    const [message] = lintJson(
      'settings-webfetch-preflight-skip',
      '{\n  "skipWebFetchPreflight": true\n}',
      path.join(tree({}), PROJECT),
    )
    expect([message?.line, message?.column]).toEqual([2, 28])
  })

  it('is silent when the file holds a WebFetch rule with a domain, in any list', () => {
    for (const list of ['allow', 'ask', 'deny']) {
      const code = JSON.stringify({
        skipWebFetchPreflight: true,
        permissions: { [list]: [FETCH] },
      })
      expect(ids(tree({}), PROJECT, code), list).toEqual([])
    }
    expect(
      ids(tree({}), MANAGED, RULES(FETCH).replace('{', '{"skipWebFetchPreflight":true,')),
    ).toEqual([])
  })

  it('is silent for a value that is not true', () => {
    for (const value of [false, null, 'true', 1]) {
      const code = JSON.stringify({ skipWebFetchPreflight: value })
      expect(ids(tree({}), PROJECT, code), String(value)).toEqual([])
    }
    expect(ids(tree({}), PROJECT, '{}')).toEqual([])
  })

  it('is silent for a hidden drop-in', () => {
    expect(ids(tree({}), 'managed-settings.d/.20-b.json')).toEqual([])
  })

  it('reports when the permission lists hold no WebFetch rule with a domain', () => {
    const odd = [
      // A bare tool, an empty specifier, other tools, and a string that is no rule.
      ['WebFetch'],
      ['WebFetch()'],
      ['WebFetch(  )'],
      ['Read(WebFetch)', 'Bash(WebFetch(domain:x))', 'WebSearch', ''],
      ['(domain:x)', 'WebFetch(domain:x', 'webfetch(domain:x)'],
      // Entries that are not strings.
      [1, null, { rule: FETCH }, [FETCH]],
    ]
    for (const entries of odd) {
      expect(
        ids(
          tree({}),
          PROJECT,
          JSON.stringify({ skipWebFetchPreflight: true, permissions: { allow: entries } }),
        ),
        JSON.stringify(entries),
      ).toEqual(['skipped'])
    }
  })

  it('reports when permissions has another shape', () => {
    for (const permissions of [
      null,
      'WebFetch(domain:x)',
      [FETCH],
      { allow: FETCH },
      { allow: null },
      {},
    ]) {
      const code = JSON.stringify({ skipWebFetchPreflight: true, permissions })
      expect(ids(tree({}), PROJECT, code), JSON.stringify(permissions)).toEqual(['skipped'])
    }
  })
})

describe('settings-webfetch-preflight-skip: the other project file', () => {
  it('is silent when the local file holds the rule, and when the project file does', () => {
    expect(ids(tree({ [LOCAL]: RULES(FETCH) }), PROJECT)).toEqual([])
    expect(ids(tree({ [PROJECT]: RULES(FETCH) }), LOCAL)).toEqual([])
  })

  it('reports when the other file holds no rule, or is not there', () => {
    expect(ids(tree({ [LOCAL]: RULES('Read(./src/**)') }), PROJECT)).toEqual(['skipped'])
    expect(ids(tree({ [LOCAL]: '{}' }), PROJECT)).toEqual(['skipped'])
    expect(ids(tree({ [PROJECT]: '{"permissions": null}' }), LOCAL)).toEqual(['skipped'])
    // Entries that are not strings hold no rule.
    expect(ids(tree({ [LOCAL]: RULES(1, null, { rule: FETCH }, [FETCH]) }), PROJECT)).toEqual([
      'skipped',
    ])
    expect(ids(tree({}), PROJECT)).toEqual(['skipped'])
  })

  it('reads the file in the same .claude folder, not another folder', () => {
    const dir = tree({ 'pkg/.claude/settings.local.json': RULES(FETCH) })
    expect(ids(dir, PROJECT)).toEqual(['skipped'])
    expect(ids(dir, 'pkg/.claude/settings.json')).toEqual([])
  })

  it('reads no file above the repository root', () => {
    const outer = tree({ [LOCAL]: RULES(FETCH) }, false)
    mkdirSync(path.join(outer, 'repo/.git'), { recursive: true })
    expect(ids(outer, `repo/${PROJECT}`)).toEqual(['skipped'])
  })

  it('makes no report when the other file cannot be seen', () => {
    // A file that does not parse to an object can hold any rule.
    for (const text of ['[]', '"x"', 'null', '{"permissions": ', '']) {
      expect(ids(tree({ [LOCAL]: text }), PROJECT), text).toEqual([])
    }
    // A read that fails: a directory in place of the file.
    const dir = tree({})
    mkdirSync(path.join(dir, LOCAL), { recursive: true })
    expect(ids(dir, PROJECT)).toEqual([])
  })

  it.skipIf(noLinks)(
    'makes no report for a link that has no target, or leads out of the repository',
    () => {
      const dangling = tree({})
      link(dangling, LOCAL, 'missing.json')
      expect(ids(dangling, PROJECT)).toEqual([])
      const outside = tree({ 'out.json': RULES(FETCH) }, false)
      const dir = tree({})
      link(dir, LOCAL, path.join(outside, 'out.json'))
      expect(ids(dir, PROJECT)).toEqual([])
    },
  )
})

describe('settings-webfetch-preflight-skip: a managed file', () => {
  it('is silent when another file of the managed source holds the rule', () => {
    expect(ids(tree({ [DROP_IN]: RULES(FETCH) }), MANAGED)).toEqual([])
    expect(ids(tree({ [MANAGED]: RULES(FETCH) }), DROP_IN)).toEqual([])
    expect(ids(tree({ 'managed-settings.d/10-a.json': RULES(FETCH) }), DROP_IN)).toEqual([])
  })

  it('reports when no file of the source holds a rule', () => {
    expect(ids(tree({ 'managed-settings.d/10-a.json': RULES('Read(x)') }), DROP_IN)).toEqual([
      'skipped',
    ])
  })

  it('does not read a project file for a managed file, nor a managed file for a project file', () => {
    expect(ids(tree({ [PROJECT]: RULES(FETCH), [LOCAL]: RULES(FETCH) }), MANAGED)).toEqual([
      'skipped',
    ])
    expect(ids(tree({ [MANAGED]: RULES(FETCH) }), PROJECT)).toEqual(['skipped'])
  })

  it('ignores a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(tree({ 'managed-settings.d/.10-a.json': RULES(FETCH) }), MANAGED)).toEqual([
      'skipped',
    ])
  })

  it('makes no report when a file of the source cannot be seen', () => {
    expect(ids(tree({ 'managed-settings.d/10-a.json': '[1]' }), MANAGED)).toEqual([])
    const dir = tree({})
    writeFileSync(path.join(dir, MANAGED), '{"permissions": ')
    expect(ids(dir, DROP_IN)).toEqual([])
  })
})
