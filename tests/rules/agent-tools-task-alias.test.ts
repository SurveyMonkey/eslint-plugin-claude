// The sub-agents page, "Restrict which subagents can be spawned": "In version
// 2.1.63, the Task tool was renamed to Agent. Existing `Task(...)` references
// in settings and agent definitions still work as aliases."
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const local = '.claude/agents/a.md'
const file = (fields: string, filename = local) => ({
  code: `---\nname: a\ndescription: d\n${fields}---\n\nBody.\n`,
  filename,
})

markdownTester.run('agent-tools-task-alias', ruleOf('agent-tools-task-alias'), {
  valid: [
    file('tools: Agent, Read\n'),
    file('tools: Agent(worker, researcher), Read\n'),
    file('disallowedTools: Agent\n'),
    // Tool names that start with `Task`, and a lower-case `task`, are other names.
    file('tools: TaskCreate, TaskGet, TaskList, TaskOutput, TaskStop, TaskUpdate\n'),
    file('tools: task, TASK\n'),
    file('tools: Read(Task)\n'),
    // An entry that does not parse, and a field with no value.
    file('tools: Task(\n'),
    file('tools:\n'),
    file(''),
    { code: '# Task\n', filename: local },
    { code: '---\nname: [unclosed\n---\n', filename: local },
    file('tools: Task\n', 'docs/a.md'),
  ],
  invalid: [
    {
      ...file('tools: Read, Task\n'),
      errors: [
        {
          messageId: 'alias',
          data: { entry: 'Task' },
          line: 4,
          column: 14,
          endLine: 4,
          endColumn: 18,
        },
      ],
    },
    {
      ...file('tools: Task(worker, researcher), Read\n'),
      errors: [
        {
          messageId: 'alias',
          data: { entry: 'Task(worker, researcher)' },
          column: 8,
          endColumn: 32,
        },
      ],
    },
    {
      ...file('disallowedTools: Task\n'),
      errors: [{ messageId: 'alias', data: { entry: 'Task' }, line: 4, column: 18 }],
    },
    // Both fields, the list form and a plugin agent.
    {
      ...file('tools:\n  - Task\n  - Read\ndisallowedTools: Task(x)\n', pluginAgent()),
      errors: [
        { messageId: 'alias', data: { entry: 'Task' }, line: 5 },
        { messageId: 'alias', data: { entry: 'Task(x)' }, line: 7 },
      ],
    },
  ],
})
