// Claude Code strips a fixed set of wrappers before it matches a Bash rule, so a rule for the
// inner command works: https://code.claude.com/docs/en/permissions#process-wrappers
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-bash-stripped-wrapper'
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
  it.fails('reports the example of the docs, in a project, local or managed file', () => {
    for (const file of [PROJECT, LOCAL, MANAGED, DROP_IN]) {
      expect(ids(allow('Bash(timeout 30 npm test)'), file), file).toEqual(['stripped'])
    }
  })

  it.fails('reports each wrapper of the docs', () => {
    for (const wrapper of [
      'timeout',
      'time',
      'nice',
      'nohup',
      'stdbuf',
      'command',
      'builtin',
      'noglob',
    ]) {
      expect(ids(allow(`Bash(${wrapper} npm test)`)), wrapper).toEqual(['stripped'])
    }
  })

  it.fails('reports the rule in allow, ask and deny', () => {
    expect(
      ids({
        permissions: { allow: ['Bash(nice *)'], ask: ['Bash(time *)'], deny: ['Bash(nohup *)'] },
      }),
    ).toEqual(['stripped', 'stripped', 'stripped'])
  })

  it.fails('reports bare xargs with an inner command, and the :* suffix', () => {
    expect(ids(allow('Bash(xargs grep *)', 'Bash(nice:*)', 'Bash(command ls)'))).toEqual([
      'stripped',
      'stripped',
      'stripped',
    ])
  })

  it.fails('reports a Monitor rule, and names the wrapper and the rule', () => {
    const [message] = lint(allow('Monitor(timeout 5 make)'))
    expect(message?.message).toContain('`Monitor(timeout 5 make)`')
    expect(message?.message).toContain('`timeout`')
    expect(message?.message).toContain('inner command')
  })

  it.fails('reports the entry, at its line and column', () => {
    const [message] = lint(JSON.stringify(allow('Bash(time ls)')))
    expect([message?.line, message?.column, message?.endLine, message?.endColumn]).toEqual([
      1, 26, 1, 41,
    ])
  })
})

describe(`${name}: the rules that it leaves alone`, () => {
  it.fails('is silent for the rule of the inner command', () => {
    expect(ids(allow('Bash(npm test)', 'Bash(npm test *)', 'Bash(grep *)'))).toEqual([])
  })

  it.fails('is silent for command -v, which the docs say is not stripped', () => {
    expect(ids(allow('Bash(command -v git)', 'Bash(command -v *)'))).toEqual([])
  })

  it.fails('is silent for xargs with a flag, and for xargs with no inner command', () => {
    expect(ids(allow('Bash(xargs -n1 grep *)', 'Bash(xargs *)', 'Bash(xargs)'))).toEqual([])
  })

  it.fails('is silent for nocorrect, which the docs say is not stripped, and other runners', () => {
    expect(ids(allow('Bash(nocorrect ls)', 'Bash(devbox run npm test)', 'Bash(watch *)'))).toEqual(
      [],
    )
  })

  it.fails('is silent when the wrapper is not the first word, or is glued to text', () => {
    expect(ids(allow('Bash(npm timeout)', 'Bash(timeout*)', 'Bash(timeouts 5 ls)'))).toEqual([])
  })

  it.fails('is silent for a tool that the Bash section does not cover, and a bare tool', () => {
    expect(ids(allow('PowerShell(timeout 5 ls)', 'Read(timeout 5)', 'Bash'))).toEqual([])
  })

  it.fails('is silent for a rule that does not parse, in a hidden drop-in, and with no rules', () => {
    expect(ids(allow('Bash(time ls'))).toEqual([])
    expect(ids(allow('Bash(time ls)'), HIDDEN)).toEqual([])
    expect(ids('{}')).toEqual([])
  })
})
