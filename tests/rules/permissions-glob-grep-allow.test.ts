// On macOS, Linux and WSL, an allow rule in a settings file does not bring the Glob and Grep
// tools back:
// https://code.claude.com/docs/en/tools-reference#glob-tool-behavior
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-glob-grep-allow'
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
  it('reports a bare Glob and a bare Grep allow rule, in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids(perms({ allow: ['Glob', 'Grep'] }), file), file).toEqual(['inert', 'inert'])
    }
  })

  it('names the tool and the way to get it back', () => {
    const [message] = lintJson(name, perms({ allow: ['Grep'] }), PROJECT)
    expect(message?.message).toContain('`Grep`')
    expect(message?.message).toContain('--allowedTools')
  })

  it('reports at the entry, at its line and column', () => {
    const text = '{\n  "permissions": {\n    "allow": ["Read", "Glob"]\n  }\n}'
    expect(lintJson(name, text, PROJECT).map(({ line, column }) => [line, column])).toEqual([
      [3, 23],
    ])
  })
})

describe(`${name}: the silent cases`, () => {
  it('is silent for a rule with a specifier, which other rules read', () => {
    expect(ids(perms({ allow: ['Glob(src/**)', 'Grep(src/**)', 'Glob(*)'] }))).toEqual([])
  })

  it('is silent in deny and ask, and for another tool', () => {
    expect(ids(perms({ deny: ['Glob'], ask: ['Grep'], allow: ['Read', 'Bash'] }))).toEqual([])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(perms({ allow: ['Glob'] }), HIDDEN)).toEqual([])
  })
})

describe(`${name}: the allow rule that permissions-dead-allow owns`, () => {
  const ALLOW = perms({ allow: ['Glob'] })
  const at = (root: string, text: string, file = '.claude/settings.json') =>
    lintJson(name, text, path.join(root, file)).map((message) => message.messageId)

  it('is silent when a bare deny or ask rule of the tool covers the allow rule', () => {
    expect(ids(perms({ allow: ['Glob'], deny: ['Glob'] }))).toEqual([])
    expect(ids(perms({ allow: ['Grep'], ask: ['Grep'] }))).toEqual([])
  })

  it('still reports when the deny rule is for the other tool', () => {
    expect(ids(perms({ allow: ['Glob'], deny: ['Grep'] }))).toEqual(['inert'])
  })

  it('is silent when the other file of the pair holds the deny rule', () => {
    const root = repo({ '.claude/settings.local.json': perms({ deny: ['Glob'] }) })
    expect(at(root, ALLOW)).toEqual([])
    expect(at(repo({}), ALLOW)).toEqual(['inert'])
  })

  it('reports when the other file holds an entry that is no rule', () => {
    const root = repo({
      '.claude/settings.local.json': JSON.stringify({ permissions: { deny: [1, 'Glob('] } }),
    })
    expect(at(root, ALLOW)).toEqual(['inert'])
  })

  it('reports when the other file holds a deny rule that is not bare', () => {
    const root = repo({ '.claude/settings.local.json': perms({ deny: ['Glob(src/**)'] }) })
    expect(at(root, ALLOW)).toEqual(['inert'])
  })

  it('reports when a deny rule sits in a managed file for a project file', () => {
    const root = repo({ 'managed-settings.json': perms({ deny: ['Glob'] }) })
    expect(at(root, ALLOW)).toEqual(['inert'])
  })

  it('reads the files of a managed source', () => {
    const root = repo({ 'managed-settings.d/20-b.json': perms({ deny: ['Glob'] }) })
    expect(at(root, ALLOW, 'managed-settings.d/10-a.json')).toEqual([])
  })
})
