// An allow rule keeps the specifier syntax of its tool, so `Agent(model:opus)` in `allow` is no
// parameter match: https://code.claude.com/docs/en/permissions#match-by-input-parameter
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-param-rule-intent'
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
      expect(ids(allow('Agent(model:opus)'), file), file).toEqual(['intent'])
    }
  })

  it.fails('reports each parameter that the docs name', () => {
    expect(
      ids(
        allow(
          'Agent(isolation:worktree)',
          'Skill(skill:deploy)',
          'Bash(run_in_background:true)',
          'Monitor(timeout:5)',
          'PowerShell(description:x)',
          'Bash(dangerouslyDisableSandbox:true)',
        ),
      ),
    ).toEqual(Array(6).fill('intent'))
  })

  it.fails('allows white space around the colon, as the docs do', () => {
    expect(ids(allow('Agent(model : opus)', 'Agent( model:opus)'))).toEqual(['intent', 'intent'])
  })

  it.fails('names the rule, the parameter and the lists that work', () => {
    const [message] = lint(allow('Agent(model:opus)'))
    expect(message?.message).toContain('`Agent(model:opus)`')
    expect(message?.message).toContain('`model`')
    expect(message?.message).toContain('`deny` and `ask`')
  })

  it.fails('reports the entry, at its line and column', () => {
    const [message] = lint(JSON.stringify(allow('Agent(model:opus)')))
    expect([message?.line, message?.column]).toEqual([1, 26])
  })
})

describe(`${name}: the rules that it leaves alone`, () => {
  it.fails('is silent for a parameter rule in deny and ask', () => {
    expect(
      ids({ permissions: { deny: ['Agent(model:opus)'], ask: ['Bash(run_in_background:true)'] } }),
    ).toEqual([])
  })

  it.fails('is silent for the own syntax of a tool', () => {
    expect(
      ids(allow('Agent(Explore)', 'Skill(deploy *)', 'Bash(git:*)', 'WebFetch(domain:a.test)')),
    ).toEqual([])
  })

  it.fails('is silent for a name that the docs do not give to the tool', () => {
    expect(
      ids(allow('Agent(skill:x)', 'Skill(model:x)', 'Read(model:x)', 'Bash(model:x)')),
    ).toEqual([])
  })

  it.fails('is silent for a primary field: permissions-param-rule owns it', () => {
    expect(ids(allow('Bash(command:rm *)', 'Read(file_path:x)'))).toEqual([])
  })

  it.fails('is silent for the :* suffix of a command rule: the colon-star rules report it', () => {
    expect(ids(allow('Bash(run_in_background:*)', 'Bash(timeout:* x)'))).toEqual([])
  })

  it.fails('reports the :* of a tool that has no command pattern', () => {
    expect(ids(allow('Agent(model:*)'))).toEqual(['intent'])
  })

  it.fails('is silent when a deny or ask rule covers the allow rule: permissions-dead-allow reports it', () => {
    expect(
      ids({ permissions: { allow: ['Agent(model:opus)'], deny: ['Agent(model:opus)'] } }),
    ).toEqual([])
    expect(ids({ permissions: { allow: ['Agent(model:opus)'], ask: ['Agent'] } })).toEqual([])
  })

  it.fails('is silent for a bare tool, a rule that does not parse, and a hidden drop-in', () => {
    expect(ids(allow('Agent', 'Agent(model:opus'))).toEqual([])
    expect(ids(allow('Agent(model:opus)'), HIDDEN)).toEqual([])
    expect(ids('{}')).toEqual([])
  })
})
