// A deny rule on a command or a file is no security boundary: the sandbox or a hook is. The rule
// reads the sandbox and the hooks of one settings source, and makes no report when it cannot read
// a sibling file: https://code.claude.com/docs/en/permissions#bash-rule-limits

import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-bash-deny-not-boundary'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const MANAGED = 'managed-settings.json'
const DROP_IN = 'managed-settings.d/10-a.json'
const HIDDEN = 'managed-settings.d/.10-a.json'

const text = (code: unknown) => (typeof code === 'string' ? code : JSON.stringify(code))
const at = (root: string, file: string, code: unknown) =>
  lintJson(name, text(code), path.join(root, file)).map((message) => message.messageId)
const alone = (code: unknown, file = PROJECT) => at(repo({}), file, code)
const deny = (...rules: string[]) => ({ permissions: { deny: rules } })
const HOOK = {
  hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'x' }] }] },
}

describe(`${name}: one file`, () => {
  it('reports a Bash deny rule with no sandbox and no hook, in each kind of file', () => {
    for (const file of [PROJECT, LOCAL, MANAGED, DROP_IN]) {
      expect(alone(deny('Bash(rm *)'), file), file).toEqual(['boundary'])
    }
  })

  it('reports a Bash ask rule, a Monitor deny rule and a Read deny rule', () => {
    expect(alone({ permissions: { ask: ['Bash(git push *)'] } })).toEqual(['boundary'])
    expect(alone(deny('Monitor(curl *)'))).toEqual(['boundary'])
    expect(alone(deny('Read(./.env)'))).toEqual(['boundary'])
  })

  it('makes one report for a file, at the first rule, and counts the rules', () => {
    const code = deny('Bash(rm *)', 'Bash(curl *)', 'Read(./.env)')
    const found = lintJson(name, text(code), '/repo/.claude/settings.json')
    expect(found).toHaveLength(1)
    expect(found[0]?.message).toContain('`Bash(rm *)`')
    expect(found[0]?.message).toContain('3 such rules')
    expect(found[0]?.message).toContain('sandbox')
    expect(found[0]?.message).toContain('PreToolUse')
  })

  it('names one rule with no count', () => {
    const [message] = lintJson(name, text(deny('Bash(rm *)')), '/repo/.claude/settings.json')
    expect(message?.message).not.toContain('rules')
  })

  it('is silent with sandbox.enabled true, and with the string "true" in a managed file', () => {
    expect(alone({ ...deny('Bash(rm *)'), sandbox: { enabled: true } })).toEqual([])
    expect(alone({ ...deny('Bash(rm *)'), sandbox: { enabled: 'true' } }, MANAGED)).toEqual([])
  })

  it('reports with sandbox.enabled false, unset, or the string "true" in a project file', () => {
    expect(alone({ ...deny('Bash(rm *)'), sandbox: { enabled: false } })).toEqual(['boundary'])
    expect(alone({ ...deny('Bash(rm *)'), sandbox: {} })).toEqual(['boundary'])
    expect(alone({ ...deny('Bash(rm *)'), sandbox: { enabled: 'true' } })).toEqual(['boundary'])
  })

  it('is silent with a PreToolUse hook, whatever its form, and reports with an empty list', () => {
    expect(alone({ ...deny('Bash(rm *)'), ...HOOK })).toEqual([])
    expect(alone({ ...deny('Bash(rm *)'), hooks: { PreToolUse: {} } })).toEqual([])
    expect(alone({ ...deny('Bash(rm *)'), hooks: { PreToolUse: [] } })).toEqual(['boundary'])
    expect(alone({ ...deny('Bash(rm *)'), hooks: { PostToolUse: [{}] } })).toEqual(['boundary'])
    expect(alone({ ...deny('Bash(rm *)'), hooks: [] })).toEqual(['boundary'])
  })

  it('is silent for a rule that is no command or file boundary', () => {
    expect(
      alone({
        permissions: {
          deny: [
            'Bash',
            'Bash(*)',
            'Bash(run_in_background:true)',
            'Read',
            'Edit(./x)',
            'WebFetch(domain:a.test)',
            'Read(offset:5)',
            'Bash(rm *',
          ],
          allow: ['Bash(rm *)', 'Read(./x)'],
          ask: ['Read(./y)'],
        },
      }),
    ).toEqual([])
  })

  it('is silent in a hidden drop-in, and with no rules', () => {
    expect(alone(deny('Bash(rm *)'), HIDDEN)).toEqual([])
    expect(alone('{}')).toEqual([])
    expect(alone('[1]')).toEqual([])
  })
})

describe(`${name}: the project pair, on disk`, () => {
  const DENY = deny('Bash(rm *)')

  it('is silent when the other file turns the sandbox on, or holds a hook', () => {
    const sandbox = repo({ [LOCAL]: text({ sandbox: { enabled: true } }) })
    expect(at(sandbox, PROJECT, DENY)).toEqual([])
    const hook = repo({ [PROJECT]: text(HOOK) })
    expect(at(hook, LOCAL, DENY)).toEqual([])
  })

  it('reports when the other file holds neither, or is not there', () => {
    expect(at(repo({ [LOCAL]: '{}' }), PROJECT, DENY)).toEqual(['boundary'])
    expect(at(repo({}), PROJECT, DENY)).toEqual(['boundary'])
  })

  it('does not read a managed file for a project file', () => {
    const root = repo({ [MANAGED]: text({ sandbox: { enabled: true } }) })
    expect(at(root, PROJECT, DENY)).toEqual(['boundary'])
  })

  it('is silent when the other file cannot be read', () => {
    expect(at(repo({ [LOCAL]: '[1]' }), PROJECT, DENY)).toEqual([])
    expect(at(repo({ [LOCAL]: '{' }), PROJECT, DENY)).toEqual([])
  })
})

describe(`${name}: a managed source, on disk`, () => {
  const DENY = deny('Bash(rm *)')

  it('is silent when another file of the source turns the sandbox on, or holds a hook', () => {
    const sandbox = repo({ [MANAGED]: text({ sandbox: { enabled: true } }) })
    expect(at(sandbox, DROP_IN, DENY)).toEqual([])
    const hook = repo({ 'managed-settings.d/20-b.json': text(HOOK) })
    expect(at(hook, MANAGED, DENY)).toEqual([])
  })

  it('reports when no file of the source holds either, and ignores a project file', () => {
    const root = repo({ [PROJECT]: text({ sandbox: { enabled: true } }) })
    expect(at(root, MANAGED, DENY)).toEqual(['boundary'])
  })

  it('ignores a hidden sibling', () => {
    const root = repo({ [HIDDEN]: text({ sandbox: { enabled: true } }) })
    expect(at(root, DROP_IN, DENY)).toEqual(['boundary'])
  })

  it('is silent when a sibling cannot be read', () => {
    const root = repo({ 'managed-settings.d/20-b.json': '[1]' })
    expect(at(root, DROP_IN, DENY)).toEqual([])
  })
})
