// Claude Code renamed the Task tool to Agent in v2.1.63, and a `Task(...)` rule still works as an
// alias:
// https://code.claude.com/docs/en/sub-agents#restrict-which-subagents-can-be-spawned
// MultiEdit is a legacy tool, and `Edit` rules apply to all built-in tools that edit files:
// https://code.claude.com/docs/en/permissions#read-and-edit
import { describe, expect, it } from 'vitest'
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

describe(`${name}: the reports`, () => {
  it.fails('reports MultiEdit and Task(x), in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids(perms({ allow: ['MultiEdit', 'Task(x)'] }), file), file).toEqual([
        'multiEdit',
        'task',
      ])
    }
  })

  it.fails('reports a bare Task, and Task in allow, ask and deny', () => {
    for (const list of ['allow', 'ask', 'deny']) {
      expect(ids(perms({ [list]: ['Task', 'Task(Explore)'] })), list).toEqual(['task', 'task'])
    }
  })

  it.fails('names the new tool and keeps the specifier in the advice', () => {
    const [task, multi] = lintJson(name, perms({ deny: ['Task(Explore)', 'MultiEdit'] }), PROJECT)
    expect(task?.message).toContain('Agent(Explore)')
    expect(task?.message).toContain('2.1.63')
    expect(multi?.message).toContain('Edit')
  })

  it.fails('names the bare Agent for a bare Task', () => {
    const [task] = lintJson(name, perms({ deny: ['Task'] }), PROJECT)
    expect(task?.message).toContain('`Agent`')
  })

  it.fails('reports a MultiEdit parameter rule, which no path rule rule reads', () => {
    expect(ids(perms({ deny: ['MultiEdit(edits:*)'] }))).toEqual(['multiEdit'])
  })

  it.fails('reports at the entry, at its line and column', () => {
    const text = '{\n  "permissions": {\n    "deny": ["Bash", "Task(x)"]\n  }\n}'
    expect(lintJson(name, text, PROJECT).map(({ line, column }) => [line, column])).toEqual([
      [3, 22],
    ])
  })
})

describe(`${name}: the silent cases`, () => {
  it.fails('is silent for Edit and Agent(x)', () => {
    expect(
      ids(perms({ allow: ['Edit', 'Agent(x)', 'Agent', 'Edit(src/**)', 'Taskx', 'task'] })),
    ).toEqual([])
  })

  it.fails('is silent for MultiEdit(path), which permissions-path-rule-tool reports', () => {
    expect(ids(perms({ deny: ['MultiEdit(docs/**)', 'MultiEdit(./a)'] }))).toEqual([])
  })

  it.fails('is silent for other tools whose names start like the legacy names', () => {
    expect(ids(perms({ deny: ['TaskStop', 'TaskCreate', 'Multi', 'mcp__a__Task'] }))).toEqual([])
  })

  it.fails('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(perms({ allow: ['Task', 'MultiEdit'] }), HIDDEN)).toEqual([])
  })
})
