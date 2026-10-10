// A relative pattern with one directory segment, such as `src/**`, matches at one depth in an
// `allow` rule and at any depth in a `deny` or `ask` rule:
// https://code.claude.com/docs/en/permissions#read-and-edit
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-allow-dir-depth'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]

const perms = (fields: Record<string, string[]>) => JSON.stringify({ permissions: fields })
const ids = (text: string, file = PROJECT) =>
  lintJson(name, text, file).map((message) => message.messageId)

describe(`${name}: the reports`, () => {
  it('reports Edit(src/**) in allow, in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids(perms({ allow: ['Edit(src/**)'] }), file), file).toEqual(['depth'])
    }
  })

  it('reports Read(src/**) and a directory with a dot, a space or a digit', () => {
    for (const rule of ['Read(src/**)', 'Edit(.github/**)', 'Edit(my docs/**)', 'Edit(v2/**)']) {
      expect(ids(perms({ allow: [rule] })), rule).toEqual(['depth'])
    }
  })

  it('reports each entry, at its line and column, and names the fix', () => {
    const text = '{\n  "permissions": {\n    "allow": ["Read", "Edit(src/**)"]\n  }\n}'
    const messages = lintJson(name, text, PROJECT)
    expect(messages.map(({ line, column }) => [line, column])).toEqual([[3, 23]])
    expect(messages[0]?.message).toContain('Edit(src/**)')
    expect(messages[0]?.message).toContain('Edit(/src/**)')
    expect(messages[0]?.message).toContain('Edit(**/src/**)')
  })
})

describe(`${name}: the silent cases`, () => {
  it('is silent for a name that is a drive letter or holds a pattern character', () => {
    for (const dir of ['C:', 'sr?', 'a[b', 'a]b', 'a\\b']) {
      expect(ids(perms({ allow: [`Edit(${dir}/**)`] })), dir).toEqual([])
    }
  })

  it('reports a pattern with white space around it', () => {
    expect(ids(perms({ allow: ['Edit( src/** )'] }))).toEqual(['depth'])
  })

  it('names the tool of the rule in the message', () => {
    const [message] = lintJson(name, perms({ allow: ['Read(src/**)'] }), PROJECT)
    expect(message?.message).toContain('Read(/src/**)')
  })

  it('is silent in deny and ask, where the pattern matches at any depth', () => {
    for (const list of ['deny', 'ask']) {
      expect(ids(perms({ [list]: ['Edit(src/**)', 'Read(src/**)'] })), list).toEqual([])
    }
  })

  it('is silent when the depth is explicit', () => {
    const rules = ['Edit(**/src/**)', 'Edit(/src/**)', 'Edit(src/components/**)', 'Edit(//src/**)']
    expect(ids(perms({ allow: rules }))).toEqual([])
  })

  it('is silent for a pattern that is not one directory segment with a final /**', () => {
    const rules = [
      'Edit(src/*)',
      'Edit(src/**/*.ts)',
      'Edit(src)',
      'Edit(src/)',
      'Edit(*/**)',
      'Edit(s*/**)',
      'Edit(~/**)',
      'Edit(../**)',
      'Edit(./**)',
      'Edit(!src/**)',
      'Edit(**)',
      'Edit(/**)',
    ]
    expect(ids(perms({ allow: rules }))).toEqual([])
  })

  it('is silent for the ./ form, which the docs do not name', () => {
    expect(ids(perms({ allow: ['Edit(./src/**)'] }))).toEqual([])
  })

  it('is silent for a tool that is not Read or Edit, and for a bare tool', () => {
    expect(
      ids(perms({ allow: ['Write(src/**)', 'Cd(src/**)', 'Bash(src/**)', 'Edit', 'Read'] })),
    ).toEqual([])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(perms({ allow: ['Edit(src/**)'] }), HIDDEN)).toEqual([])
  })

  it('skips an entry that is not a string and one that does not parse', () => {
    const text = JSON.stringify({ permissions: { allow: [1, 'Edit(src/**', 'Edit(src/**)'] } })
    expect(ids(text)).toEqual(['depth'])
  })
})
