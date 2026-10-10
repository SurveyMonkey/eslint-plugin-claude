// A prefix rule such as `Bash(watch *)` cannot auto-approve `watch`, `setsid`, `ionice` or `flock`.
// In Manual mode they always prompt, and only an exact-match rule approves one invocation:
// https://code.claude.com/docs/en/permissions#process-wrappers
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-bash-exec-wrapper-prefix'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const NESTED = '/repo/packages/a/.claude/settings.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const LOCAL_NAMED_DROP_IN = '/repo/managed-settings.d/settings.local.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const PROJECT_FILES = [PROJECT, LOCAL, NESTED]
const MANAGED_FILES = [MANAGED, DROP_IN, LOCAL_NAMED_DROP_IN]

const lint = (code: unknown, file = PROJECT) =>
  lintJson(name, typeof code === 'string' ? code : JSON.stringify(code), file)
const ids = (code: unknown, file = PROJECT) => lint(code, file).map((message) => message.messageId)
const allow = (...rules: string[]) => ({ permissions: { allow: rules } })

describe(`${name}: the reports`, () => {
  it('reports the example of the docs, in a project, local or managed file', () => {
    for (const file of [...PROJECT_FILES, ...MANAGED_FILES]) {
      expect(ids(allow('Bash(watch *)'), file), file).toEqual(['prefix'])
    }
  })

  it('reports each wrapper of the docs', () => {
    for (const wrapper of ['watch', 'setsid', 'ionice', 'flock']) {
      expect(ids(allow(`Bash(${wrapper} *)`)), wrapper).toEqual(['prefix'])
    }
  })

  it('reports a prefix rule that holds more words, and the :* suffix', () => {
    for (const rule of ['Bash(watch -n 5 *)', 'Bash(flock /tmp/lock *)', 'Bash(watch:*)']) {
      expect(ids(allow(rule)), rule).toEqual(['prefix'])
    }
  })

  it('reports a Monitor rule, which uses the rules of Bash', () => {
    expect(ids(allow('Monitor(watch *)'))).toEqual(['prefix'])
  })

  it('reports each entry once', () => {
    expect(ids(allow('Bash(watch *)', 'Bash(watch ls)', 'Bash(setsid *)'))).toEqual([
      'prefix',
      'prefix',
    ])
  })

  it('names the wrapper, and says to write an exact-match rule', () => {
    const [message] = lint(allow('Bash(setsid *)'))
    expect(message?.message).toContain('`Bash(setsid *)`')
    expect(message?.message).toContain('`setsid`')
    expect(message?.message).toContain('always prompt')
    expect(message?.message).toContain('exact')
  })

  it('reports the entry, at its line, column and end', () => {
    const [message] = lint(JSON.stringify(allow('Bash(watch *)')))
    expect([message?.line, message?.column, message?.endLine, message?.endColumn]).toEqual([
      1, 26, 1, 41,
    ])
  })
})

describe(`${name}: the rules that it leaves alone`, () => {
  it('is silent for an exact-match rule, which the docs name as the way to approve one', () => {
    for (const rule of [
      'Bash(watch ls)',
      'Bash(watch -n 5 git status)',
      'Bash(flock /tmp/l make)',
    ]) {
      expect(ids(allow(rule)), rule).toEqual([])
    }
  })

  it('is silent for a rule that does not start with the wrapper', () => {
    for (const rule of [
      'Bash(npm run watch *)',
      'Bash(watchman *)',
      'Bash(watch*)',
      'Bash(* watch *)',
      'Bash(sudo watch *)',
      'Bash(timeout 5 watch *)',
    ]) {
      expect(ids(allow(rule)), rule).toEqual([])
    }
  })

  it('is silent for a wrapper that Claude Code strips, and for find', () => {
    for (const rule of ['Bash(nice *)', 'Bash(timeout 30 *)', 'Bash(nohup *)', 'Bash(find *)']) {
      expect(ids(allow(rule)), rule).toEqual([])
    }
  })

  it('is silent for a * in the middle: the rule is no prefix rule', () => {
    expect(ids(allow('Bash(watch * ls)'))).toEqual([])
  })

  it('is silent for a tool that the Bash section does not cover', () => {
    expect(ids(allow('PowerShell(watch *)', 'Read(watch *)'))).toEqual([])
  })

  it('is silent in deny and ask, which hold no grant', () => {
    expect(ids({ permissions: { deny: ['Bash(watch *)'], ask: ['Bash(watch *)'] } })).toEqual([])
  })

  it('is silent for a rule that does not parse: permissions-rule-syntax reports it', () => {
    expect(ids(allow('Bash(watch *'))).toEqual([])
  })

  it('is silent for an entry that is no string, and a list that is no array', () => {
    expect(ids({ permissions: { allow: [3, null] } })).toEqual([])
    expect(ids({ permissions: { allow: 'Bash(watch *)' } })).toEqual([])
    expect(ids('[1]')).toEqual([])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(allow('Bash(watch *)'), HIDDEN)).toEqual([])
  })

  it('is silent for a bare tool name', () => {
    expect(ids(allow('Bash', 'Monitor', 'PowerShell'))).toEqual([])
  })

  it('names the tool of the rule in the message', () => {
    expect(lint(allow('Monitor(watch *)'))[0]?.message).toContain('`Monitor(watch *)`')
  })
})
