// A trailing `:*` is the same as a final ` *`. The permission dialog writes the space form:
// https://code.claude.com/docs/en/permissions#wildcard-patterns
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-bash-colon-star-suffix'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]

const perms = (fields: Record<string, string[]>) => JSON.stringify({ permissions: fields })
const ids = (text: string, file = PROJECT) =>
  lintJson(name, text, file).map((message) => message.messageId)

describe(`${name}: the report`, () => {
  it('reports a trailing :* in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids(perms({ allow: ['Bash(ls:*)'] }), file), file).toEqual(['suffix'])
    }
  })

  it('reports in allow, ask and deny, and for each command tool', () => {
    for (const list of ['allow', 'ask', 'deny']) {
      expect(ids(perms({ [list]: ['Bash(ls:*)'] })), list).toEqual(['suffix'])
    }
    for (const tool of ['Bash', 'PowerShell', 'Monitor']) {
      expect(ids(perms({ allow: [`${tool}(ls:*)`] })), tool).toEqual(['suffix'])
    }
  })

  it('names the rule and the space form', () => {
    const [message] = lintJson(name, perms({ allow: ['Bash(git push:*)'] }), PROJECT)
    expect(message?.message).toContain('Bash(git push:*)')
    expect(message?.message).toContain('Bash(git push *)')
  })

  it('names the tool and writes one space before the star', () => {
    const [ps] = lintJson(name, perms({ allow: ['PowerShell(Get-Item :*)'] }), PROJECT)
    expect(ps?.message).toBe(
      '`PowerShell(Get-Item :*)` is the same as `PowerShell(Get-Item *)`. Write the space form, which the permission dialog writes.',
    )
  })

  it('reports a one-character command and a trailing space', () => {
    expect(ids(perms({ allow: ['Bash(x:*)'] }))).toEqual(['suffix'])
    expect(ids(perms({ allow: ['Bash(ls:* )'] }))).toEqual(['suffix'])
  })

  it('reports a rule with a :* in the middle as well, for the end', () => {
    expect(ids(perms({ allow: ['Bash(git:* push:*)'] }))).toEqual(['suffix'])
  })

  it('reports at the entry, at its line and column', () => {
    const text = '{\n  "permissions": {\n    "allow": ["Bash(ls:*)"]\n  }\n}'
    expect(lintJson(name, text, PROJECT).map(({ line, column }) => [line, column])).toEqual([
      [3, 15],
    ])
  })
})

describe(`${name}: the silent cases`, () => {
  it('is silent for a deny or ask rule on an input parameter, where * is a value wildcard', () => {
    for (const list of ['deny', 'ask']) {
      expect(ids(perms({ [list]: ['Bash(run_in_background:*)'] })), list).toEqual([])
    }
    expect(ids(perms({ allow: ['Bash(run_in_background:*)'] }))).toEqual(['suffix'])
  })

  it('is silent for the space form, and for a rule with no :*', () => {
    for (const rule of ['Bash(ls *)', 'Bash(ls)', 'Bash', 'Bash(*)', 'Bash(git:* push)']) {
      expect(ids(perms({ allow: [rule] })), rule).toEqual([])
    }
  })

  it('is silent for a tool that is not a command tool', () => {
    for (const rule of ['Read(./a:*)', 'WebFetch(domain:*)', 'Agent(isolation:*)']) {
      expect(ids(perms({ allow: [rule] })), rule).toEqual([])
    }
  })

  it('is silent for a :* that stands alone, which Claude Code reads as text', () => {
    expect(ids(perms({ allow: ['Bash(:*)'] }))).toEqual([])
  })

  it('is silent for a rule that does not parse, and for a list that is not an array', () => {
    expect(ids(perms({ allow: ['Bash(ls:*'] }))).toEqual([])
    expect(ids(JSON.stringify({ permissions: { allow: 'Bash(ls:*)' } }))).toEqual([])
    expect(ids('{}')).toEqual([])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(perms({ allow: ['Bash(ls:*)'] }), HIDDEN)).toEqual([])
  })
})
