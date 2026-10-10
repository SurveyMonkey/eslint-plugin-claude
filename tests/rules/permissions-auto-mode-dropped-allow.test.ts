// Auto mode drops the allow rules that grant arbitrary code execution:
// https://code.claude.com/docs/en/permission-modes#how-auto-mode-evaluates-actions
// Auto mode is a runtime choice, so the rule is a heuristic. The tests of a source use files on disk.
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
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
const withOptions = (options: unknown[], text: string, file = PROJECT) =>
  new Linter({ cwd: path.parse(path.resolve('/repo', file)).root })
    .verify(
      text,
      [
        {
          files: ['**/*.json'],
          plugins: { json, claude: plugin },
          language: 'json/json',
          rules: { [`claude/${name}`]: ['error', ...options] },
        },
      ],
      { filename: path.resolve('/repo', file) },
    )
    .map((message) => message.messageId)

describe(`${name}: the report`, () => {
  it('reports a wildcarded python interpreter, in every file', () => {
    for (const file of EVERY_FILE) {
      for (const rule of ['Bash(python*)', 'Bash(python *)', 'Bash(python:*)']) {
        expect(allow(rule, file), `${file} ${rule}`).toEqual(['dropped'])
      }
    }
  })

  it('reports PowerShell(python*) too', () => {
    expect(allow('PowerShell(python*)')).toEqual(['dropped'])
  })

  it('reports an Agent rule and a Monitor rule, with or without a specifier', () => {
    for (const rule of ['Agent', 'Agent(Explore)', 'Monitor', 'Monitor(tail *)']) {
      expect(allow(rule), rule).toEqual(['dropped'])
    }
  })

  it('reports each dropped entry', () => {
    expect(alone(perms({ allow: ['Bash(python*)', 'Agent', 'Monitor'] }))).toEqual([
      'dropped',
      'dropped',
      'dropped',
    ])
  })

  it('names the rule and the reason', () => {
    const message = (rule: string) =>
      lintJson(name, perms({ allow: [rule] }), `/repo/${PROJECT}`)[0]?.message
    expect(message('Bash(python*)')).toBe(
      '`Bash(python*)` is a wildcarded `python` interpreter rule. In auto mode, Claude Code drops this allow rule, and the classifier reviews each action instead. Claude Code restores it when you leave auto mode.',
    )
    expect(message('Agent(Explore)')).toContain('`Agent(Explore)` is an allow rule for Agent.')
    expect(message('Monitor')).toContain('`Monitor` is an allow rule for Monitor.')
  })

  it('reports each entry, at its line and column', () => {
    const text = '{\n  "permissions": {\n    "allow": ["Read", "Bash(python*)"]\n  }\n}'
    expect(
      lintJson(name, text, `/repo/${PROJECT}`).map(({ line, column }) => [line, column]),
    ).toEqual([[3, 23]])
  })
})

describe(`${name}: the silent cases`, () => {
  it('is silent for a rule that approves every command, which permissions-allow-unrestricted reports', () => {
    for (const rule of ['Bash(*)', 'PowerShell(*)', 'Bash', 'PowerShell']) {
      for (const file of EVERY_FILE) {
        expect(allow(rule, file), `${file} ${rule}`).toEqual([])
      }
    }
  })

  it('is silent for an interpreter rule with a word after the star', () => {
    for (const rule of ['Bash(python * foo)', 'Bash(python * *)']) {
      expect(allow(rule, PROJECT), rule).toEqual([])
    }
  })

  it('is silent for an interpreter that the docs do not name, unless the option names it', () => {
    for (const rule of ['Bash(python3 *)', 'Bash(node*)', 'Bash(node *)', 'Bash(ruby *)']) {
      expect(allow(rule), rule).toEqual([])
    }
  })

  it('is silent for an interpreter with a fixed word', () => {
    for (const rule of [
      'Bash(python* -m pytest)',
      'Bash(python foo)',
      'Bash(python)',
      'Bash(Python *)',
    ]) {
      expect(allow(rule), rule).toEqual([])
    }
  })

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
    expect(allow('Agent', HIDDEN)).toEqual([])
  })
})

describe(`${name}: a source that turns auto mode off`, () => {
  const BASH = perms({ allow: ['Agent'] })

  it('is silent when the file sets disableAutoMode to "disable", at the top or in permissions', () => {
    expect(alone(perms({ allow: ['Agent'] }, { disableAutoMode: 'disable' }))).toEqual([])
    expect(alone(perms({ allow: ['Agent'], disableAutoMode: 'disable' }))).toEqual([])
  })

  it('reports when disableAutoMode has another value in a project file', () => {
    for (const value of [true, 'enable', null]) {
      expect(alone(perms({ allow: ['Agent'] }, { disableAutoMode: value })), String(value)).toEqual(
        ['dropped'],
      )
    }
  })

  it('is silent for any top-level value but null in a managed file, which Claude Code reads as "disable"', () => {
    expect(alone(perms({ allow: ['Agent'] }, { disableAutoMode: true }), MANAGED)).toEqual([])
    expect(alone(perms({ allow: ['Agent'] }, { disableAutoMode: null }), MANAGED)).toEqual([
      'dropped',
    ])
  })

  it('reads the lock inside permissions as "disable" only, outside a managed file', () => {
    const nested = (value: unknown) => perms({ allow: ['Agent'], disableAutoMode: value })
    expect(alone(nested('disable'))).toEqual([])
    expect(alone(nested(true))).toEqual(['dropped'])
  })

  it('reads any value but null inside permissions as "disable" in a managed file', () => {
    const nested = (value: unknown) => perms({ allow: ['Agent'], disableAutoMode: value })
    for (const file of [MANAGED, DROP_IN]) {
      for (const value of ['disable', true, false, 0, '', 'enable']) {
        expect(alone(nested(value), file), `${file} ${String(value)}`).toEqual([])
      }
      expect(alone(nested(null), file), file).toEqual(['dropped'])
    }
  })

  it('reads any top-level value but null as "disable" in a managed file, and no value but "disable" in a project file', () => {
    for (const value of [false, 0, '', 'enable']) {
      expect(
        alone(perms({ allow: ['Agent'] }, { disableAutoMode: value }), DROP_IN),
        String(value),
      ).toEqual([])
    }
  })

  it('is not silenced by a lock in a hidden drop-in or in another source', () => {
    const hidden = repo({
      'managed-settings.d/.20-b.json': JSON.stringify({ disableAutoMode: 'disable' }),
    })
    expect(at(hidden, DROP_IN, perms({ allow: ['Agent'] }))).toEqual(['dropped'])
    const managed = repo({ [MANAGED]: JSON.stringify({ disableAutoMode: 'disable' }) })
    expect(at(managed, PROJECT, perms({ allow: ['Agent'] }))).toEqual(['dropped'])
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

describe(`${name}: the option interpreters`, () => {
  const text = (rule: string) => perms({ allow: [rule] })

  it('adds to the default list, in a project file and a managed file', () => {
    for (const file of [PROJECT, MANAGED]) {
      const options = [{ interpreters: ['node'] }]
      expect(withOptions(options, text('Bash(node *)'), file), file).toEqual(['dropped'])
      expect(withOptions(options, text('Bash(node*)'), file), file).toEqual(['dropped'])
      expect(withOptions(options, text('Bash(python *)'), file), file).toEqual(['dropped'])
      expect(withOptions(options, text('Bash(ruby *)'), file), file).toEqual([])
    }
  })

  it('names the program of the option in the message', () => {
    const [message] = new Linter({ cwd: '/' }).verify(
      text('Bash(node *)'),
      [
        {
          files: ['**/*.json'],
          plugins: { json, claude: plugin },
          language: 'json/json',
          rules: { [`claude/${name}`]: ['error', { interpreters: ['node'] }] },
        },
      ],
      { filename: path.resolve('/repo', PROJECT) },
    )
    expect(message?.message).toContain('wildcarded `node` interpreter')
  })

  it('takes no option, and an empty object, as the default', () => {
    expect(withOptions([], text('Bash(node *)'))).toEqual([])
    expect(withOptions([{}], text('Bash(node *)'))).toEqual([])
    expect(withOptions([{ interpreters: [] }], text('Bash(python *)'))).toEqual(['dropped'])
  })

  it('refuses an empty name, a repeated name, a string and an unknown key', () => {
    for (const option of [
      { interpreters: [''] },
      { interpreters: ['node', 'node'] },
      { interpreters: 'node' },
      { other: true },
    ]) {
      expect(() => withOptions([option], text('Bash(node *)')), JSON.stringify(option)).toThrow()
    }
  })
})
