// Claude Code runs the built-in read-only commands without a prompt, so an allow rule for one adds
// nothing: https://code.claude.com/docs/en/permissions#read-only-commands
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-bash-readonly-redundant'
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
      expect(ids(allow('Bash(ls)'), file), file).toEqual(['redundant'])
    }
  })

  it.fails('reports each command of the docs, as the bare command and as the prefix rule', () => {
    for (const command of [
      'ls',
      'cat',
      'echo',
      'pwd',
      'head',
      'tail',
      'grep',
      'wc',
      'which',
      'diff',
      'stat',
      'du',
    ]) {
      expect(
        ids(allow(`Bash(${command})`, `Bash(${command} *)`, `Bash(${command}:*)`)),
        command,
      ).toEqual(['redundant', 'redundant', 'redundant'])
    }
  })

  it.fails('reports the bare find and the bare cd', () => {
    expect(ids(allow('Bash(find)', 'Bash(cd)'))).toEqual(['redundant', 'redundant'])
  })

  it.fails('reports a Monitor rule, which has the rules of Bash', () => {
    expect(ids(allow('Monitor(ls)'))).toEqual(['redundant'])
  })

  it.fails('names the rule and the command', () => {
    const [message] = lint(allow('Bash(ls *)'))
    expect(message?.message).toContain('`Bash(ls *)`')
    expect(message?.message).toContain('`ls`')
    expect(message?.message).toContain('without a prompt')
  })

  it.fails('reports the entry, at its line and column', () => {
    const [message] = lint(JSON.stringify(allow('Bash(ls)')))
    expect([message?.line, message?.column]).toEqual([1, 26])
  })
})

describe(`${name}: the rules that it leaves alone`, () => {
  it.fails('is silent for a command that is not read-only', () => {
    expect(ids(allow('Bash(npm test)', 'Bash(rm)', 'Bash(git status)', 'Bash(git *)'))).toEqual([])
  })

  it.fails('is silent for find with an argument: an action or a glob still prompts', () => {
    expect(
      ids(
        allow('Bash(find *)', 'Bash(find . -delete)', 'Bash(find . -exec rm {} ;)', 'Bash(find:*)'),
      ),
    ).toEqual([])
  })

  it.fails('is silent for cd with a target: a target out of the working directories prompts', () => {
    expect(ids(allow('Bash(cd *)', 'Bash(cd /tmp)', 'Bash(cd src)'))).toEqual([])
  })

  it.fails('is silent for a rule with more words than the command', () => {
    expect(ids(allow('Bash(ls -la)', 'Bash(cat /etc/hosts)', 'Bash(grep -r foo *)'))).toEqual([])
  })

  it.fails('is silent for a longer program name, a glued wildcard, and a wrapper', () => {
    expect(ids(allow('Bash(lsof)', 'Bash(ls*)', 'Bash(timeout 5 ls)'))).toEqual([])
  })

  it.fails('is silent in deny and ask: a rule there requires a prompt, which the docs advise', () => {
    expect(ids({ permissions: { deny: ['Bash(cat *)'], ask: ['Bash(ls)'] } })).toEqual([])
  })

  it.fails('is silent when a deny or ask rule covers the allow rule: permissions-dead-allow reports it', () => {
    expect(ids({ permissions: { allow: ['Bash(ls)'], deny: ['Bash(ls)'] } })).toEqual([])
  })

  it.fails('is silent for a bare tool, a PowerShell rule, and a rule that does not parse', () => {
    expect(ids(allow('Bash', 'PowerShell(ls)', 'Bash(ls'))).toEqual([])
  })

  it.fails('is silent in a hidden drop-in, and with no rules', () => {
    expect(ids(allow('Bash(ls)'), HIDDEN)).toEqual([])
    expect(ids('{}')).toEqual([])
  })
})
