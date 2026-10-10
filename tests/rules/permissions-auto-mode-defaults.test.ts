// An `autoMode` array without the entry "$defaults" replaces the built-in list of its section:
// https://code.claude.com/docs/en/auto-mode-config#override-the-block-and-allow-rules
// The classifier does not read `autoMode` from the two project files
// (https://code.claude.com/docs/en/auto-mode-config#where-the-classifier-reads-configuration),
// so the rule reads managed files only. Arrays of the managed files add up.
import { symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-auto-mode-defaults'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const MANAGED = 'managed-settings.json'
const DROP_IN = 'managed-settings.d/10-a.json'
const HIDDEN = 'managed-settings.d/.10-a.json'
const LISTS = ['environment', 'allow', 'soft_deny', 'hard_deny']

const auto = (fields: object) => JSON.stringify({ autoMode: fields })
const at = (root: string, file: string, text: string) => lintJson(name, text, path.join(root, file))
const ids = (text: string, file = MANAGED) =>
  at(repo({}), file, text).map((message) => message.messageId)

describe(`${name}: the report`, () => {
  it('reports each list without "$defaults", in a managed file and a drop-in', () => {
    for (const file of [MANAGED, DROP_IN]) {
      for (const list of LISTS) {
        expect(
          ids(auto({ [list]: ['Never run terraform apply'] }), file),
          `${list} ${file}`,
        ).toEqual(['replaced'])
      }
    }
  })

  it('reports an empty list, which removes every built-in rule of the section', () => {
    expect(ids(auto({ soft_deny: [] }))).toEqual(['replaced'])
  })

  it('reports each list that lacks "$defaults", and not the list that has it', () => {
    expect(ids(auto({ soft_deny: ['x'], hard_deny: ['$defaults', 'y'], allow: ['z'] }))).toEqual([
      'replaced',
      'replaced',
    ])
  })

  it('reports at the array, and names the list and what it drops', () => {
    const text = '{\n  "autoMode": {\n    "soft_deny": ["a"]\n  }\n}'
    const [message] = at(repo({}), MANAGED, text)
    expect([message?.line, message?.column]).toEqual([3, 18])
    expect(message?.message).toContain('soft_deny')
    expect(message?.message).toContain('force push')
    const [hard] = at(repo({}), MANAGED, auto({ hard_deny: ['a'] }))
    expect(hard?.message).toContain('exfiltration')
    const [environment] = at(repo({}), MANAGED, auto({ environment: ['a'] }))
    expect(environment?.message).toContain('trust')
    const [allow] = at(repo({}), MANAGED, auto({ allow: ['a'] }))
    expect(allow?.message).toContain('allow')
  })

  it('reports the last of two keys, as JSON.parse reads them', () => {
    expect(ids('{"autoMode":{"soft_deny":["$defaults"],"soft_deny":["a"]}}')).toEqual(['replaced'])
    expect(ids('{"autoMode":{"soft_deny":["a"],"soft_deny":["$defaults"]}}')).toEqual([])
  })

  it('counts only the exact string "$defaults"', () => {
    expect(ids(auto({ soft_deny: ['$default', '$DEFAULTS', ' $defaults', 5] }))).toEqual([
      'replaced',
    ])
  })
})

describe(`${name}: the silent cases`, () => {
  it('is silent when each list holds "$defaults", at any position', () => {
    expect(
      ids(
        auto({
          environment: ['$defaults'],
          allow: ['a', '$defaults'],
          soft_deny: ['a', '$defaults', 'b'],
        }),
      ),
    ).toEqual([])
  })

  it('is silent for a list that is not an array, an unset list, and an autoMode that is not an object', () => {
    expect(ids(auto({ soft_deny: 'x', hard_deny: null, environment: { a: 1 } }))).toEqual([])
    expect(ids(auto({ classifyAllShell: true }))).toEqual([])
    expect(ids('{ "autoMode": "x" }')).toEqual([])
    expect(ids('{ "autoMode": null }')).toEqual([])
    expect(ids('{}')).toEqual([])
    expect(ids('[1]')).toEqual([])
  })

  it('is silent in a project and a local file, where the classifier does not read autoMode', () => {
    for (const file of [PROJECT, LOCAL]) {
      expect(ids(auto({ soft_deny: ['a'] }), file), file).toEqual([])
    }
  })

  it('is silent in a hidden drop-in', () => {
    expect(ids(auto({ soft_deny: ['a'] }), HIDDEN)).toEqual([])
  })
})

describe(`${name}: a managed source, on disk`, () => {
  const LACKS = auto({ soft_deny: ['a'] })
  const HAS = auto({ soft_deny: ['$defaults'] })

  it('is silent when another file of the source holds "$defaults" in the same list', () => {
    const root = repo({ [DROP_IN]: HAS })
    expect(at(root, MANAGED, LACKS)).toEqual([])
    const main = repo({ [MANAGED]: HAS })
    expect(at(main, 'managed-settings.d/20-b.json', LACKS)).toEqual([])
  })

  it('reports when another file holds "$defaults" in another list only', () => {
    const root = repo({ [DROP_IN]: auto({ hard_deny: ['$defaults'] }) })
    expect(at(root, MANAGED, LACKS).map((m) => m.messageId)).toEqual(['replaced'])
  })

  it('reports when the other files of the source lack it too', () => {
    const root = repo({ [DROP_IN]: auto({ soft_deny: ['b'] }) })
    expect(at(root, MANAGED, LACKS).map((m) => m.messageId)).toEqual(['replaced'])
  })

  it('does not read a project file for a managed file', () => {
    const root = repo({ [PROJECT]: HAS })
    expect(at(root, MANAGED, LACKS).map((m) => m.messageId)).toEqual(['replaced'])
  })

  it('ignores a hidden sibling', () => {
    const root = repo({ [HIDDEN]: HAS })
    expect(at(root, MANAGED, LACKS).map((m) => m.messageId)).toEqual(['replaced'])
  })

  it('is silent when a file of the source cannot be read, because it can hold "$defaults"', () => {
    const root = repo({ [DROP_IN]: '[1]' })
    expect(at(root, MANAGED, LACKS)).toEqual([])
    expect(at(root, MANAGED, HAS)).toEqual([])
  })

  it('is silent for a drop-in directory that is a link out of the repository', {
    skip: process.platform === 'win32',
  }, () => {
    const root = repo({})
    const outside = repo({ [DROP_IN]: HAS })
    symlinkSync(path.join(outside, 'managed-settings.d'), path.join(root, 'managed-settings.d'))
    expect(at(root, MANAGED, LACKS)).toEqual([])
  })
})
