// `Bash(ls*)` has no space before the `*`, so it also matches `lsof`:
// https://code.claude.com/docs/en/permissions#wildcard-patterns
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-bash-glued-wildcard'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'

const lint = (code: unknown, file = PROJECT) =>
  lintJson(name, typeof code === 'string' ? code : JSON.stringify(code), file)
const ids = (code: unknown, file = PROJECT) => lint(code, file).map((message) => message.messageId)
const allow = (...rules: string[]) => ({ permissions: { allow: rules } })

describe(`${name}: the reports`, () => {
  it('reports the example of the docs, in a project, local or managed file', () => {
    for (const file of [PROJECT, LOCAL, MANAGED, DROP_IN]) {
      expect(ids(allow('Bash(ls*)'), file), file).toEqual(['glued'])
    }
  })

  it('reports a Monitor and a PowerShell rule, which have the shape of a Bash rule', () => {
    expect(ids(allow('Monitor(git*)', 'PowerShell(git*)'))).toEqual(['glued', 'glued'])
  })

  it('gives the tool of the rule in the fix', () => {
    expect(lint(allow('Monitor(git*)'))[0]?.message).toContain('`Monitor(git *)`')
  })

  it('is silent for a PowerShell cmdlet name pattern', () => {
    expect(ids(allow('PowerShell(Get-*)', 'PowerShell(Get-Child*)'))).toEqual([])
  })

  it('reports a hyphen in a Bash or Monitor rule, and a PowerShell program with no hyphen', () => {
    expect(ids(allow('Bash(docker-*)', 'Monitor(docker-*)', 'PowerShell(git*)'))).toEqual([
      'glued',
      'glued',
      'glued',
    ])
  })

  it('is silent for a backslash', () => {
    expect(ids(allow('Bash(ls\\*)'))).toEqual([])
  })

  it('names the rule, and gives the rule with the space', () => {
    const [message] = lint(allow('Bash(ls*)'))
    expect(message?.message).toContain('`Bash(ls*)`')
    expect(message?.message).toContain('`ls`')
    expect(message?.message).toContain('`Bash(ls *)`')
  })

  it('gives a fix with a space for each reported form', () => {
    for (const [rule, fixed] of [
      ['Bash(git*)', 'Bash(git *)'],
      ['Bash( ls* )', 'Bash(ls *)'],
      ['Bash(docker-compose*)', 'Bash(docker-compose *)'],
    ] as const) {
      expect(lint(allow(rule))[0]?.message, rule).toContain(`\`${fixed}\``)
    }
  })

  it('reports the entry, at its line and column', () => {
    const [message] = lint(JSON.stringify(allow('Bash(ls*)')))
    expect([message?.line, message?.column, message?.endLine, message?.endColumn]).toEqual([
      1, 26, 1, 37,
    ])
  })
})

describe(`${name}: the rules that it leaves alone`, () => {
  it('is silent for the rule with a space, and for the :* suffix', () => {
    expect(ids(allow('Bash(ls *)', 'Bash(ls:*)', 'Bash(ls)'))).toEqual([])
  })

  it('is silent for a * after more than the program, and for a * inside a word', () => {
    expect(
      ids(allow('Bash(npm run test*)', 'Bash(git log*)', 'Bash(*)', 'Bash(**)', 'Bash(l*s)')),
    ).toEqual([])
  })

  it('is silent for a path glob, which names files and not a program', () => {
    expect(ids(allow('Bash(./scripts/*)', 'Bash(/usr/bin/*)'))).toEqual([])
  })

  it('is silent in deny and ask, where a wider match only blocks more', () => {
    expect(ids({ permissions: { deny: ['Bash(rm*)'], ask: ['Bash(git*)'] } })).toEqual([])
  })

  it('is silent for a tool with no command pattern, a bare tool, and a rule that does not parse', () => {
    expect(ids(allow('Read(ls*)', 'Bash', 'Bash(ls*'))).toEqual([])
  })

  it('is silent in a hidden drop-in, and for a file with no rules', () => {
    expect(ids(allow('Bash(ls*)'), HIDDEN)).toEqual([])
    expect(ids('{}')).toEqual([])
  })
})
