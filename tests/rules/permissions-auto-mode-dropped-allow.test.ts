// Auto mode drops the allow rules that grant arbitrary code execution:
// https://code.claude.com/docs/en/permission-modes#how-auto-mode-evaluates-actions
// Auto mode is a runtime choice, so the rule is a heuristic. The tests of a source use files on disk.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-auto-mode-dropped-allow'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const MANAGED = 'managed-settings.json'
const DROP_IN = 'managed-settings.d/10-a.json'
const HIDDEN = 'managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]

const perms = (fields: Record<string, unknown>, extra: object = {}) =>
  JSON.stringify({ permissions: fields, ...extra })
const at = (root: string, file: string, text: string) =>
  lintJson(name, text, path.join(root, file)).map((message) => message.messageId)
const alone = (text: string, file = PROJECT) => at(repo({}), file, text)
const allow = (rule: string, file = PROJECT) => alone(perms({ allow: [rule] }), file)

describe(`${name}: the report`, () => {
  it('reports Bash(*) and PowerShell(*), in every file', () => {
    for (const file of EVERY_FILE) {
      expect(allow('Bash(*)', file), file).toEqual(['dropped'])
      expect(allow('PowerShell(*)', file), file).toEqual(['dropped'])
    }
  })

  it('reports a bare Bash or PowerShell, which match every command', () => {
    expect(allow('Bash')).toEqual(['dropped'])
    expect(allow('PowerShell')).toEqual(['dropped'])
  })

  it('reports a wildcarded interpreter', () => {
    for (const rule of [
      'Bash(python*)',
      'Bash(python *)',
      'Bash(python:*)',
      'Bash(python3 *)',
      'Bash(node*)',
      'Bash(node *)',
      'Bash(ruby *)',
      'Bash(perl *)',
      'PowerShell(python*)',
    ]) {
      expect(allow(rule), rule).toEqual(['dropped'])
    }
  })

  it('reports an Agent rule and a Monitor rule, with or without a specifier', () => {
    for (const rule of ['Agent', 'Agent(Explore)', 'Monitor', 'Monitor(tail *)']) {
      expect(allow(rule), rule).toEqual(['dropped'])
    }
  })

  it('names the rule and the reason', () => {
    const [bash] = lintJson(name, perms({ allow: ['Bash(python*)'] }), `/repo/${PROJECT}`)
    expect(bash?.message).toContain('Bash(python*)')
    expect(bash?.message).toContain('interpreter')
    const [agent] = lintJson(name, perms({ allow: ['Agent'] }), `/repo/${PROJECT}`)
    expect(agent?.message).toContain('Agent')
  })

  it('reports each entry, at its line and column', () => {
    const text = '{\n  "permissions": {\n    "allow": ["Read", "Bash(*)"]\n  }\n}'
    expect(
      lintJson(name, text, `/repo/${PROJECT}`).map(({ line, column }) => [line, column]),
    ).toEqual([[3, 23]])
  })
})

describe(`${name}: the silent cases`, () => {
  it('is silent for a narrow rule, which stays in effect', () => {
    for (const rule of [
      'Bash(npm test)',
      'Bash(npm run test)',
      'Bash(python -m pytest)',
      'Bash(python -m pytest *)',
      'Bash(git *)',
      'Bash(pythonista*)',
      'Bash(nodemon *)',
      'Bash()',
      'Read',
      'Read(*)',
      'Edit(*)',
      'WebFetch',
      'mcp__a__b',
    ]) {
      expect(allow(rule), rule).toEqual([])
    }
  })

  it('is silent in ask and deny', () => {
    for (const list of ['ask', 'deny']) {
      expect(
        alone(perms({ [list]: ['Bash(*)', 'Bash(python*)', 'Agent', 'Monitor'] })),
        list,
      ).toEqual([])
    }
  })

  it('is silent for a rule that does not parse, and for a list that is not an array', () => {
    expect(allow('Bash(')).toEqual([])
    expect(alone(JSON.stringify({ permissions: { allow: 'Bash(*)' } }))).toEqual([])
    expect(alone('{}')).toEqual([])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(allow('Bash(*)', HIDDEN)).toEqual([])
  })
})

describe(`${name}: a source that turns auto mode off`, () => {
  const BASH = perms({ allow: ['Bash(*)'] })

  it('is silent when the file sets disableAutoMode to "disable", at the top or in permissions', () => {
    expect(alone(perms({ allow: ['Bash(*)'] }, { disableAutoMode: 'disable' }))).toEqual([])
    expect(alone(perms({ allow: ['Bash(*)'], disableAutoMode: 'disable' }))).toEqual([])
  })

  it('reports when disableAutoMode has another value in a project file', () => {
    for (const value of [true, 'enable', null]) {
      expect(
        alone(perms({ allow: ['Bash(*)'] }, { disableAutoMode: value })),
        String(value),
      ).toEqual(['dropped'])
    }
  })

  it('is silent for any top-level value but null in a managed file, which Claude Code reads as "disable"', () => {
    expect(alone(perms({ allow: ['Bash(*)'] }, { disableAutoMode: true }), MANAGED)).toEqual([])
    expect(alone(perms({ allow: ['Bash(*)'] }, { disableAutoMode: null }), MANAGED)).toEqual([
      'dropped',
    ])
  })

  it('reads the lock inside permissions as "disable" only, even in a managed file', () => {
    const nested = (value: unknown) => perms({ allow: ['Bash(*)'], disableAutoMode: value })
    expect(alone(nested('disable'), MANAGED)).toEqual([])
    expect(alone(nested(true), MANAGED)).toEqual(['dropped'])
  })

  it('reads the other file of the project pair', () => {
    const root = repo({ [LOCAL]: JSON.stringify({ disableAutoMode: 'disable' }) })
    expect(at(root, PROJECT, BASH)).toEqual([])
    const plain = repo({ [LOCAL]: JSON.stringify({ permissions: { allow: ['Read'] } }) })
    expect(at(plain, PROJECT, BASH)).toEqual(['dropped'])
  })

  it('reads the other files of a managed source, and no project file', () => {
    const root = repo({ [MANAGED]: JSON.stringify({ disableAutoMode: 'disable' }) })
    expect(at(root, DROP_IN, BASH)).toEqual([])
    const project = repo({ [PROJECT]: JSON.stringify({ disableAutoMode: 'disable' }) })
    expect(at(project, MANAGED, BASH)).toEqual(['dropped'])
  })

  it('is silent when a file of the source does not read, because it can hold the lock', () => {
    const root = repo({ [LOCAL]: '{' })
    expect(at(root, PROJECT, BASH)).toEqual([])
    const managed = repo({ 'managed-settings.d/20-b.json': '{' })
    expect(at(managed, DROP_IN, BASH)).toEqual([])
  })
})
