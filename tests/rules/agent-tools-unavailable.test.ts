// The sub-agents page, "Available tools": the first filter removes a short
// list of tools from every subagent, even when `tools` lists them. The second
// filter keeps only some built-in tools in a background subagent.

import { pluginAgent } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const agent = '.claude/agents/a.md'
const file = (fields: string, filename = agent) => ({
  code: `---\nname: a\ndescription: d\n${fields}---\n\nBody\n`,
  filename,
})

markdownTester.run('agent-tools-unavailable', ruleOf('agent-tools-unavailable'), {
  valid: [
    file('tools: Read, Grep, Glob, Bash\n'),
    // `ExitPlanMode` stays in a plan-mode subagent.
    file('permissionMode: plan\ntools: ExitPlanMode, Read\n'),
    // The foreground set keeps the tools that a background subagent loses.
    file('tools: CronCreate, Monitor, SendUserFile\n'),
    file('background: false\ntools: CronCreate\n'),
    file('tools: CronCreate\n', pluginAgent()),
    // The background set, and the entries that the first filter keeps for `Agent`.
    file(
      'background: true\ntools: Read, Grep, Glob, LSP, Bash, PowerShell, Edit, Write, NotebookEdit, WebFetch, WebSearch, TodoWrite, Skill, ToolSearch, EnterWorktree, ExitWorktree, Monitor, TaskStop, SendMessage, Artifact, SubagentHandback, Agent\n',
    ),
    // A background subagent keeps each MCP tool, and an unknown name is for `agent-tools-known`.
    file('background: true\ntools: mcp__s__t, mcp__s, Bogus\n'),
    file('background: true\ntools: Agent(worker)\n'),
    // The `disallowedTools` field removes a tool, so it lists no tool to keep.
    file('disallowedTools: AskUserQuestion, ExitPlanMode\n'),
    file('background: "true"\ntools: CronCreate\n'),
    file('tools: AskUserQuestion\n', 'docs/a.md'),
    file('tools:\n'),
    file('tools: Read(\n'),
    { code: '# No frontmatter\n', filename: agent },
    file('tools: [unclosed\n'),
  ],
  invalid: [
    {
      ...file('tools: Read, AskUserQuestion\n'),
      errors: [
        {
          messageId: 'removed',
          data: { tool: 'AskUserQuestion' },
          line: 4,
          column: 14,
          endColumn: 29,
        },
      ],
    },
    // Each tool of the first filter.
    {
      ...file(
        'tools: AskUserQuestion, EndConversation, EnterPlanMode, ScheduleWakeup, WaitForMcpServers, Workflow\n',
      ),
      errors: [
        { messageId: 'removed', data: { tool: 'AskUserQuestion' } },
        { messageId: 'removed', data: { tool: 'EndConversation' } },
        { messageId: 'removed', data: { tool: 'EnterPlanMode' } },
        { messageId: 'removed', data: { tool: 'ScheduleWakeup' } },
        { messageId: 'removed', data: { tool: 'WaitForMcpServers' } },
        { messageId: 'removed', data: { tool: 'Workflow' } },
      ],
    },
    // A specifier does not change the tool.
    { ...file('tools: Workflow(x)\n'), errors: [{ messageId: 'removed' }] },
    // A plugin agent, and the list form.
    {
      ...file('tools:\n  - Read\n  - EndConversation\n', pluginAgent()),
      errors: [{ messageId: 'removed', line: 6 }],
    },
    // `ExitPlanMode` needs `permissionMode: plan`.
    {
      ...file('tools: ExitPlanMode\n'),
      errors: [{ messageId: 'planMode', data: { tool: 'ExitPlanMode' } }],
    },
    {
      ...file('permissionMode: default\ntools: ExitPlanMode\n'),
      errors: [{ messageId: 'planMode' }],
    },
    // A background subagent loses the built-in tools outside its set.
    {
      ...file('background: true\ntools: Read, CronCreate, ListAgents\n'),
      errors: [
        { messageId: 'background', data: { tool: 'CronCreate' }, line: 5, column: 14 },
        { messageId: 'background', data: { tool: 'ListAgents' } },
      ],
    },
    // The first filter takes priority, so one entry gets one report.
    {
      ...file('background: true\ntools: AskUserQuestion, ExitPlanMode\n'),
      errors: [{ messageId: 'removed' }, { messageId: 'planMode' }],
    },
  ],
})
