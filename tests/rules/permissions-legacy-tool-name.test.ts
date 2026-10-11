// Claude Code renamed the Task tool to Agent in v2.1.63, and a `Task(...)` rule still works as an
// alias:
// https://code.claude.com/docs/en/sub-agents#restrict-which-subagents-can-be-spawned
// MultiEdit is a legacy tool, and `Edit` rules apply to all built-in tools that edit files:
// https://code.claude.com/docs/en/permissions#read-and-edit
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-legacy-tool-name'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]

const perms = (fields: Record<string, string[]>) => JSON.stringify({ permissions: fields })
const ids = (text: string, file = PROJECT) =>
  lintJson(name, text, file).map((message) => message.messageId)
// `lintJson` takes no options, so the option tests run the rule with a `Linter` of their own.
const withOptions = (text: string, options: unknown[]) =>
  new Linter({ cwd: '/' })
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
      { filename: PROJECT },
    )
    .map((message) => message.messageId)

describe(`${name}: the reports`, () => {
  it('reports MultiEdit and Task(x), in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids(perms({ allow: ['MultiEdit', 'Task(x)'] }), file), file).toEqual([
        'multiEdit',
        'task',
      ])
    }
  })

  it('reports a bare Task, and Task in allow, ask and deny', () => {
    for (const list of ['allow', 'ask', 'deny']) {
      expect(ids(perms({ [list]: ['Task', 'Task(Explore)'] })), list).toEqual(['task', 'task'])
    }
  })

  it('names the new tool and keeps the specifier in the advice', () => {
    const [task, multi] = lintJson(name, perms({ deny: ['Task(Explore)', 'MultiEdit'] }), PROJECT)
    expect(task?.message).toContain('Agent(Explore)')
    expect(task?.message).toContain('2.1.63')
    expect(multi?.message).toContain('Edit')
  })

  it('names the bare Agent for a bare Task', () => {
    const [task] = lintJson(name, perms({ deny: ['Task'] }), PROJECT)
    expect(task?.message).toContain('`Agent`')
  })

  it('reports at the entry, at its line and column', () => {
    const text = '{\n  "permissions": {\n    "deny": ["Bash", "Task(x)"]\n  }\n}'
    expect(lintJson(name, text, PROJECT).map(({ line, column }) => [line, column])).toEqual([
      [3, 22],
    ])
  })
})

describe(`${name}: the option minVersion`, () => {
  const both = perms({ deny: ['Task(x)', 'MultiEdit'] })

  it('keeps the Task report when minVersion is unset, or 2.1.63 or later', () => {
    expect(withOptions(both, [])).toEqual(['task', 'multiEdit'])
    expect(withOptions(both, [{}])).toEqual(['task', 'multiEdit'])
    for (const minVersion of ['2.1.63', '2.1.64', '2.2.0', '3.0.0', '2.1.1000']) {
      expect(withOptions(both, [{ minVersion }]), minVersion).toEqual(['task', 'multiEdit'])
    }
  })

  it('drops the Task report, and keeps the MultiEdit report, below 2.1.63', () => {
    for (const minVersion of ['2.1.62', '2.1.0', '2.0.300', '1.9.9', '0.0.1']) {
      expect(withOptions(both, [{ minVersion }]), minVersion).toEqual(['multiEdit'])
    }
  })

  it('refuses a minVersion that is not a version', () => {
    for (const minVersion of ['2.1', 'latest', '2.1.x', '', 2.1]) {
      expect(() => withOptions(both, [{ minVersion }]), String(minVersion)).toThrow()
    }
  })
})

describe(`${name}: the silent cases`, () => {
  it('is silent for Edit and Agent(x)', () => {
    expect(
      ids(perms({ allow: ['Edit', 'Agent(x)', 'Agent', 'Edit(src/**)', 'Taskx', 'task'] })),
    ).toEqual([])
  })

  it('is silent for MultiEdit(path), which permissions-path-rule-tool reports, and any other specifier', () => {
    expect(
      ids(perms({ deny: ['MultiEdit(docs/**)', 'MultiEdit(./a)', 'MultiEdit(edits:*)'] })),
    ).toEqual([])
  })

  it('is silent for other tools whose names start like the legacy names', () => {
    expect(ids(perms({ deny: ['TaskStop', 'TaskCreate', 'Multi', 'mcp__a__Task'] }))).toEqual([])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(perms({ allow: ['Task', 'MultiEdit'] }), HIDDEN)).toEqual([])
  })
})
