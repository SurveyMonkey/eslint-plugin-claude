// A `:*` anywhere but the end of a command pattern is a literal colon, so the rule never matches
// as intended: https://code.claude.com/docs/en/permissions#wildcard-patterns
// The docs state this with no version. The rule reports on every version.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-bash-colon-star-mid'
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
  it('reports a mid-pattern :* in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids(perms({ allow: ['Bash(git:* push)'] }), file), file).toEqual(['mid'])
    }
  })

  it('reports in allow, ask and deny, and for each command tool', () => {
    for (const list of ['allow', 'ask', 'deny']) {
      expect(ids(perms({ [list]: ['Bash(git:* push)'] })), list).toEqual(['mid'])
    }
    for (const tool of ['Bash', 'PowerShell', 'Monitor']) {
      expect(ids(perms({ allow: [`${tool}(git:* push)`] })), tool).toEqual(['mid'])
    }
  })

  it('reports a :* in the middle that is followed by a :* at the end, once', () => {
    expect(ids(perms({ allow: ['Bash(git:* push:*)'] }))).toEqual(['mid'])
  })

  it('names the rule and the form that works', () => {
    const [message] = lintJson(name, perms({ allow: ['Bash(git:* push)'] }), PROJECT)
    expect(message?.message).toContain('Bash(git:* push)')
    expect(message?.message).toContain('Bash(git push *)')
  })

  it('reports at the entry, at its line and column', () => {
    const text = '{\n  "permissions": {\n    "allow": ["Bash(git:* push)"]\n  }\n}'
    expect(lintJson(name, text, PROJECT).map(({ line, column }) => [line, column])).toEqual([
      [3, 15],
    ])
  })
})

describe(`${name}: the silent cases`, () => {
  it('is silent for :* at the end', () => {
    for (const rule of ['Bash(git:*)', 'Bash(git push:*)', 'Bash(git:* )', 'PowerShell(Get-:*)']) {
      expect(ids(perms({ allow: [rule] })), rule).toEqual([])
    }
  })

  it('is silent for a pattern with no :*, and for a bare tool', () => {
    for (const rule of [
      'Bash(git * push)',
      'Bash(git push)',
      'Bash',
      'Bash(*)',
      'Bash()',
      'Bash(:*)',
      'Bash(curl http://localhost:*/health)',
    ]) {
      expect(ids(perms({ allow: [rule] })), rule).toEqual([])
    }
  })

  it('is silent for a tool that is not a command tool', () => {
    for (const rule of ['Read(./a:* b)', 'WebFetch(domain:*)', 'mcp__a__b(x:* y)']) {
      expect(ids(perms({ allow: [rule] })), rule).toEqual([])
    }
  })

  it('is silent for a rule that does not parse, and for a list that is not an array', () => {
    expect(ids(perms({ allow: ['Bash(git:* push'] }))).toEqual([])
    expect(ids(JSON.stringify({ permissions: { allow: 'Bash(git:* push)' } }))).toEqual([])
    expect(ids('{}')).toEqual([])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(perms({ allow: ['Bash(git:* push)'] }), HIDDEN)).toEqual([])
  })
})
