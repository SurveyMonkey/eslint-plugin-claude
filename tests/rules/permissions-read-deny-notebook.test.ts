// A `Read` deny rule also blocks the Edit and Write tools on the same path. NotebookEdit is not
// covered, so an `Edit` deny rule is needed for a path that no tool may change:
// https://code.claude.com/docs/en/permissions#read-and-edit
// The rule adds up the deny lists of one source, so the tests use files on disk.

import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-read-deny-notebook'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const MANAGED = 'managed-settings.json'
const DROP_IN = 'managed-settings.d/10-a.json'
const HIDDEN = 'managed-settings.d/.10-a.json'

const perms = (fields: Record<string, string[]>) => JSON.stringify({ permissions: fields })
const run = (text: string, file = PROJECT, files: Record<string, string> = {}) =>
  lintJson(name, text, path.join(repo(files), file))
const ids = (text: string, file = PROJECT, files: Record<string, string> = {}) =>
  run(text, file, files).map((message) => message.messageId)

describe(`${name}: the reports`, () => {
  it('reports a Read deny rule with no Edit deny rule, in every file', () => {
    for (const file of [PROJECT, LOCAL, MANAGED, DROP_IN]) {
      expect(ids(perms({ deny: ['Read(./secrets/**)'] }), file), file).toEqual(['notebook'])
    }
  })

  it('names the Edit rule to add, and reports at the entry', () => {
    const text = '{\n  "permissions": {\n    "deny": ["Bash", "Read(./secrets/**)"]\n  }\n}'
    const messages = run(text)
    expect(messages.map(({ line, column }) => [line, column])).toEqual([[3, 22]])
    expect(messages[0]?.message).toContain('Edit(./secrets/**)')
    expect(messages[0]?.message).toContain('NotebookEdit')
  })

  it('reports each Read deny rule that has no match', () => {
    const text = perms({ deny: ['Read(./a/**)', 'Read(./b/**)', 'Edit(./a/**)'] })
    expect(run(text).map((message) => message.message)).toEqual([
      expect.stringContaining('Read(./b/**)'),
    ])
  })

  it('reports an Edit deny rule for another path, and an Edit rule in allow or ask', () => {
    expect(ids(perms({ deny: ['Read(./a/**)', 'Edit(./b/**)'] }))).toEqual(['notebook'])
    expect(
      ids(perms({ deny: ['Read(./a/**)'], allow: ['Edit(./a/**)'], ask: ['Edit(./a/**)'] })),
    ).toEqual(['notebook'])
  })

  it('reports a Write or NotebookEdit deny rule with the path, which Claude Code never consults', () => {
    expect(ids(perms({ deny: ['Read(./a/**)', 'Write(./a/**)', 'NotebookEdit(./a/**)'] }))).toEqual(
      ['notebook'],
    )
  })

  it('reports a Read deny rule with an absolute or a home anchor', () => {
    expect(ids(perms({ deny: ['Read(//etc/**)', 'Read(~/.ssh/**)'] }))).toEqual([
      'notebook',
      'notebook',
    ])
  })
})

describe(`${name}: the silent cases`, () => {
  it('is silent when an Edit deny rule has the same path', () => {
    expect(ids(perms({ deny: ['Read(./secrets/**)', 'Edit(./secrets/**)'] }))).toEqual([])
  })

  it('reads ./path and path as one path, and ignores white space', () => {
    expect(ids(perms({ deny: ['Read(secrets/**)', 'Edit(./secrets/**)'] }))).toEqual([])
    expect(ids(perms({ deny: ['Read(./secrets/**)', 'Edit(secrets/**)'] }))).toEqual([])
    expect(ids(perms({ deny: ['Read( ./a )', 'Edit(./a)'] }))).toEqual([])
  })

  it('is silent when a bare Edit or bare NotebookEdit deny rule exists', () => {
    for (const bare of ['Edit', 'NotebookEdit']) {
      expect(ids(perms({ deny: ['Read(./secrets/**)', bare] })), bare).toEqual([])
    }
  })

  it('is silent for a Read rule in allow or ask, a bare Read, and another tool', () => {
    expect(
      ids(perms({ allow: ['Read(./a)'], ask: ['Read(./a)'], deny: ['Read', 'Bash(x)'] })),
    ).toEqual([])
  })

  it('is silent for a ! rule, which carves a path out of a block and blocks nothing', () => {
    expect(ids(perms({ deny: ['Read(*.env)', 'Edit(*.env)', 'Read(!sample.env)'] }))).toEqual([])
    expect(ids(perms({ deny: ['Read(!sample.env)'] }))).toEqual([])
  })

  it('is silent for a parameter rule', () => {
    expect(ids(perms({ deny: ['Read(offset:5)'] }))).toEqual([])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(perms({ deny: ['Read(./a)'] }), HIDDEN)).toEqual([])
  })
})

describe(`${name}: the project pair, on disk`, () => {
  const READ = perms({ deny: ['Read(./secrets/**)'] })
  const EDIT = perms({ deny: ['Edit(./secrets/**)'] })

  it('adds up the deny rules of the other file, whichever file holds the Read rule', () => {
    expect(ids(READ, PROJECT, { [LOCAL]: EDIT })).toEqual([])
    expect(ids(READ, LOCAL, { [PROJECT]: EDIT })).toEqual([])
  })

  it('reports when the other file holds no match', () => {
    expect(ids(READ, PROJECT, { [LOCAL]: perms({ deny: ['Edit(./other/**)'] }) })).toEqual([
      'notebook',
    ])
  })

  it('is silent when the other file cannot be read, because it can hold the Edit rule', () => {
    expect(ids(READ, PROJECT, { [LOCAL]: '[1]' })).toEqual([])
    expect(ids(READ, PROJECT, { [LOCAL]: '{' })).toEqual([])
  })

  it('does not read a managed file for a project file', () => {
    expect(ids(READ, PROJECT, { [MANAGED]: EDIT })).toEqual(['notebook'])
  })

  it('reads a sibling list that is not an array, and entries that are no rule, as no rule', () => {
    expect(
      ids(READ, PROJECT, { [LOCAL]: JSON.stringify({ permissions: { deny: 'Edit' } }) }),
    ).toEqual(['notebook'])
    expect(
      ids(READ, PROJECT, { [LOCAL]: JSON.stringify({ permissions: { deny: [1, 'Edit('] } }) }),
    ).toEqual(['notebook'])
  })
})

describe(`${name}: a managed source, on disk`, () => {
  const READ = perms({ deny: ['Read(./secrets/**)'] })
  const EDIT = perms({ deny: ['Edit(./secrets/**)'] })

  it('adds up the deny rules of the files of the source', () => {
    expect(ids(READ, DROP_IN, { [MANAGED]: EDIT })).toEqual([])
    expect(ids(READ, MANAGED, { 'managed-settings.d/20-b.json': EDIT })).toEqual([])
  })

  it('ignores a hidden sibling, and a project file', () => {
    expect(ids(READ, DROP_IN, { 'managed-settings.d/.20-b.json': EDIT })).toEqual(['notebook'])
    expect(ids(READ, MANAGED, { [PROJECT]: EDIT })).toEqual(['notebook'])
  })

  it('is silent when a sibling cannot be read', () => {
    expect(ids(READ, DROP_IN, { 'managed-settings.d/20-b.json': '[1]' })).toEqual([])
  })
})
