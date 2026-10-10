// Any `Cd` allow rule switches `/cd` to allowlist mode: the target must match an allow rule, or
// `/cd` refuses:
// https://code.claude.com/docs/en/permissions#cd
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-cd-allowlist'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]

const perms = (fields: Record<string, string[]>) => JSON.stringify({ permissions: fields })
const run = (text: string, file = PROJECT) => lintJson(name, text, file)

describe(`${name}: the report`, () => {
  it.fails('reports one Cd allow rule, in every file', () => {
    for (const file of EVERY_FILE) {
      expect(
        run(perms({ allow: ['Cd(~/code/**)'] }), file).map((m) => m.messageId),
        file,
      ).toEqual(['allowlist'])
    }
  })

  it.fails('reports a bare Cd allow rule', () => {
    expect(run(perms({ allow: ['Cd'] })).map((m) => m.messageId)).toEqual(['allowlist'])
  })

  it.fails('gives one report for two Cd allow rules, at the first', () => {
    const text = '{\n  "permissions": {\n    "allow": ["Read", "Cd(~/a/**)", "Cd(~/b/**)"]\n  }\n}'
    const messages = run(text)
    expect(messages.map(({ line, column }) => [line, column])).toEqual([[3, 23]])
    expect(messages[0]?.message).toContain('Cd(~/a/**)')
    expect(messages[0]?.message).toContain('2 allow rules')
  })

  it.fails('says that the first rule stands alone when there is one', () => {
    expect(run(perms({ allow: ['Cd(~/a/**)'] }))[0]?.message).not.toContain('allow rules')
  })
})

describe(`${name}: the silent cases`, () => {
  it.fails('is silent for a Cd rule in deny or ask', () => {
    expect(run(perms({ deny: ['Cd', 'Cd(~/a/**)'], ask: ['Cd(~/b/**)'] }))).toEqual([])
  })

  it.fails('is silent for another tool, and for no rules', () => {
    expect(run(perms({ allow: ['Read(~/a/**)', 'Bash(cd *)'] }))).toEqual([])
    expect(run('{}')).toEqual([])
  })

  it.fails('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(run(perms({ allow: ['Cd(~/a/**)'] }), HIDDEN)).toEqual([])
  })
})
