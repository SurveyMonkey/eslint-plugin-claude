// An allow rule for the whole of a shell tool, or for every WebFetch domain, approves every
// command or fetch. `WebFetch(domain:*)` also lets sandboxed commands reach any host:
// https://code.claude.com/docs/en/permissions#match-all-uses-of-a-tool
// https://code.claude.com/docs/en/permissions#allow-or-deny-every-fetch
// https://code.claude.com/docs/en/permissions#powershell
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-allow-unrestricted'
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
  it('reports a bare Bash in a project, local or managed file', () => {
    for (const file of [...PROJECT_FILES, ...MANAGED_FILES]) {
      expect(ids(allow('Bash'), file), file).toEqual(['command'])
    }
  })

  it('reports each form of the row', () => {
    expect(ids(allow('Bash'))).toEqual(['command'])
    expect(ids(allow('Bash(*)'))).toEqual(['command'])
    expect(ids(allow('PowerShell'))).toEqual(['command'])
    expect(ids(allow('PowerShell(*)'))).toEqual(['command'])
    expect(ids(allow('WebFetch(domain:*)'))).toEqual(['fetch'])
  })

  it('reports each entry once, in file order', () => {
    expect(ids(allow('Bash', 'Read', 'WebFetch(domain:*)', 'Bash(*)'))).toEqual([
      'command',
      'fetch',
      'command',
    ])
  })

  it('says that the rule approves every command, without manual approval', () => {
    const [message] = lint(allow('Bash(*)'))
    expect(message?.message).toContain('`Bash(*)`')
    expect(message?.message).toContain('every Bash command')
    expect(message?.message).toContain('without manual approval')
  })

  it('says that the PowerShell rule approves every PowerShell command', () => {
    expect(lint(allow('PowerShell'))[0]?.message).toContain('every PowerShell command')
  })

  it('says that the fetch rule opens the sandbox network to any host', () => {
    const [message] = lint(allow('WebFetch(domain:*)'))
    expect(message?.message).toContain('every fetch')
    expect(message?.message).toContain('any host')
  })

  it('reports the entry, at its line, column and end', () => {
    const [message] = lint(JSON.stringify(allow('Bash(*)')))
    expect([message?.line, message?.column, message?.endLine, message?.endColumn]).toEqual([
      1, 26, 1, 35,
    ])
  })
})

describe(`${name}: the rules that it leaves alone`, () => {
  it('is silent for a scoped grant', () => {
    for (const rule of [
      'Bash(npm test)',
      'Bash(npm run *)',
      'Bash(git *)',
      'Bash(* --version)',
      'Bash(**)',
      'Bash()',
      'PowerShell(Get-ChildItem *)',
      'WebFetch(domain:example.com)',
      'WebFetch(domain:*.example.com)',
      'WebFetch(domain:example.*)',
    ]) {
      expect(ids(allow(rule)), rule).toEqual([])
    }
  })

  it('is silent for the bare WebFetch, which leaves the sandbox allowlist as it is', () => {
    expect(ids(allow('WebFetch'))).toEqual([])
  })

  it('is silent for the tools that the row does not name', () => {
    for (const rule of ['Monitor', 'Monitor(*)', 'Read', 'Edit', 'Write(*)', 'Skill', 'Read(*)']) {
      expect(ids(allow(rule)), rule).toEqual([])
    }
  })

  it('is silent for a tool-name glob: permissions-tool-name-glob reports it', () => {
    expect(ids(allow('*', 'mcp__*'))).toEqual([])
  })

  it('is silent in deny and ask, where the same rule blocks or prompts', () => {
    expect(
      ids({
        permissions: { deny: ['Bash', 'WebFetch(domain:*)'], ask: ['Bash(*)', 'PowerShell'] },
      }),
    ).toEqual([])
  })

  it('is silent for a rule that does not parse: permissions-rule-syntax reports it', () => {
    expect(ids(allow('Bash(*'))).toEqual([])
  })

  it('is silent for an entry that is no string, and a list that is no array', () => {
    expect(ids({ permissions: { allow: [3, null] } })).toEqual([])
    expect(ids({ permissions: { allow: 'Bash' } })).toEqual([])
    expect(ids('[1]')).toEqual([])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(allow('Bash'), HIDDEN)).toEqual([])
  })
})
