// The same rule twice in one file. `permissions-dead-allow` owns an `allow` rule that an equal
// `deny` or `ask` rule covers, so this rule reads the same rule twice in one list, and an `ask`
// rule that an equal `deny` rule repeats.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-duplicate-rule'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]

const perms = (fields: Record<string, string[]>) => JSON.stringify({ permissions: fields })
const ids = (text: string, file = PROJECT) =>
  lintJson(name, text, file).map((message) => message.messageId)

describe(`${name}: one list`, () => {
  it.fails('reports the second of one rule in a list, in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids(perms({ allow: ['Bash(ls *)', 'Bash(ls *)'] }), file), file).toEqual(['duplicate'])
    }
  })

  it.fails('reports in allow, ask and deny', () => {
    for (const list of ['allow', 'ask', 'deny']) {
      expect(ids(perms({ [list]: ['Read(./a)', 'Read(./a)'] })), list).toEqual(['duplicate'])
    }
  })

  it.fails('reports each repeat once, and names the first', () => {
    const messages = lintJson(name, perms({ allow: ['Edit', 'Edit', 'Edit'] }), PROJECT)
    expect(messages.map((message) => message.line)).toEqual([1, 1])
    expect(messages[0]?.message).toContain('`Edit`')
    expect(messages[0]?.message).toContain('allow')
  })

  it.fails('reports at the second entry, at its line and column', () => {
    const text = '{\n  "permissions": {\n    "allow": [\n      "Edit",\n      "Edit"\n    ]\n  }\n}'
    expect(lintJson(name, text, PROJECT).map(({ line, column }) => [line, column])).toEqual([
      [5, 7],
    ])
  })

  it.fails('counts :* at the end and a final space-star as one rule', () => {
    expect(ids(perms({ allow: ['Bash(ls:*)', 'Bash(ls *)'] }))).toEqual(['duplicate'])
    expect(ids(perms({ deny: ['PowerShell(Get-Item:*)', 'PowerShell(Get-Item *)'] }))).toEqual([
      'duplicate',
    ])
  })

  it.fails('counts white space between words as one rule, and a bare tool as Tool(*)', () => {
    expect(ids(perms({ allow: ['Bash(git  push)', 'Bash(git push)'] }))).toEqual(['duplicate'])
    expect(ids(perms({ allow: ['Bash', 'Bash(*)'] }))).toEqual(['duplicate'])
  })

  it.fails('counts a trailing dot in a WebFetch domain as one rule', () => {
    expect(
      ids(perms({ allow: ['WebFetch(domain:example.com)', 'WebFetch(domain:example.com.)'] })),
    ).toEqual(['duplicate'])
  })

  it.fails('is silent for rules that differ', () => {
    const cases = [
      ['Bash(ls *)', 'Bash(ls)'],
      ['Bash(ls *)', 'Bash(ls -l *)'],
      ['Bash(git:* push)', 'Bash(git * push)'],
      ['Read(./a)', 'Read(./b)'],
      ['Read', 'Edit'],
      ['Read(./a)', 'Edit(./a)'],
      ['Read(./a.)', 'Read(./a)'],
      ['Read', 'Read(*)'],
      ['WebFetch(domain:a.com)', 'WebFetch(domain:b.com)'],
    ]
    for (const [first, second] of cases) {
      expect(
        ids(perms({ allow: [first as string, second as string] })),
        `${first} ${second}`,
      ).toEqual([])
    }
  })

  it.fails('is silent for a rule that does not parse, and for a list that is not an array', () => {
    expect(ids(perms({ allow: ['Bash(', 'Bash('] }))).toEqual([])
    expect(ids(JSON.stringify({ permissions: { allow: 'Edit' } }))).toEqual([])
    expect(ids('{}')).toEqual([])
  })

  it.fails('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(perms({ allow: ['Edit', 'Edit'] }), HIDDEN)).toEqual([])
  })
})

describe(`${name}: more than one list`, () => {
  it.fails('reports an ask rule that an equal deny rule repeats, whichever comes first in the file', () => {
    expect(ids(perms({ ask: ['Bash(rm *)'], deny: ['Bash(rm *)'] }))).toEqual(['duplicate'])
    const [message] = lintJson(name, perms({ deny: ['Bash(rm *)'], ask: ['Bash(rm *)'] }), PROJECT)
    expect(message?.message).toContain('deny')
  })

  it.fails('reports the ask rule, which the deny rule makes useless', () => {
    const text = '{\n  "permissions": {\n    "deny": ["Edit"],\n    "ask": ["Edit"]\n  }\n}'
    expect(lintJson(name, text, PROJECT).map(({ line }) => line)).toEqual([4])
  })

  it.fails('leaves an equal allow rule to permissions-dead-allow, under a deny or an ask rule', () => {
    expect(ids(perms({ allow: ['Bash(ls *)'], ask: ['Bash(ls:*)'] }))).toEqual([])
    expect(ids(perms({ allow: ['Bash(ls *)'], deny: ['Bash(ls *)'] }))).toEqual([])
    expect(ids(perms({ allow: ['Edit', 'Edit'], ask: ['Edit'] }))).toEqual([])
    expect(ids(perms({ allow: ['Bash'], deny: ['Bash(*)'] }))).toEqual([])
  })

  it.fails('reports an allow rule under a deny rule of the same domain that dead-allow reads as another', () => {
    expect(
      ids(perms({ allow: ['WebFetch(domain:a.com.)'], deny: ['WebFetch(domain:a.com)'] })),
    ).toEqual(['duplicate'])
  })

  it.fails('is silent for the same rule in allow and in a deny rule of another tool', () => {
    expect(ids(perms({ allow: ['Read(./a)'], deny: ['Edit(./a)'] }))).toEqual([])
  })

  it.fails('reports each repeat in ask once, behind a deny rule', () => {
    expect(ids(perms({ ask: ['Edit', 'Edit'], deny: ['Edit'] }))).toEqual([
      'duplicate',
      'duplicate',
    ])
  })
})
