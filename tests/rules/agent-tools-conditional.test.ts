// The sub-agents page, "Available tools": a background subagent keeps only a
// set of built-in tools, and the background is the default run mode. At the
// depth limit Claude Code withholds `Agent`, so a list of `Agent` alone
// resolves to nothing (errors page, "Agent would be spawned with zero tools").
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const local = '.claude/agents/a.md'
const file = (fields: string, filename = local) => ({
  code: `---\nname: a\ndescription: d\n${fields}---\n\nBody.\n`,
  filename,
})

markdownTester.run('agent-tools-conditional', ruleOf('agent-tools-conditional'), {
  valid: [
    file('tools: Read, Grep, Glob, Bash\n'),
    file(''),
    // `background: true` is for agent-tools-unavailable.
    file('background: true\ntools: Read, CronCreate\n'),
    file('background: yes\ntools: CronCreate\n'),
    file('background: "true"\ntools: CronCreate\n'),
    // A value that is no Boolean is for the schema rule.
    file('background: maybe\ntools: CronCreate\n'),
    file('background: [true]\ntools: CronCreate\n'),
    // Tools that no subagent keeps are for agent-tools-unavailable.
    file('tools: AskUserQuestion, Workflow, EnterPlanMode, ExitPlanMode\n'),
    // The background set, with the tools that follow the first filter.
    file(
      'tools: Read, Grep, Glob, LSP, Bash, PowerShell, Edit, Write, NotebookEdit, WebFetch, WebSearch, TodoWrite, Skill, ToolSearch, EnterWorktree, ExitWorktree, Monitor, TaskStop, SendMessage, Artifact, SubagentHandback\n',
    ),
    // An MCP tool, an unknown name and a name that does not parse are for other rules.
    file('tools: mcp__s__t, mcp__s, Bogus, Read(\n'),
    // The list holds `Agent` and another tool.
    file('tools: Agent, Read\n'),
    file('tools: Agent(worker), Bash\n'),
    file('tools: Agent, Bogus\n'),
    file('tools: Agent, Read(\n'),
    // Only `disallowedTools` lists the tool.
    file('disallowedTools: CronCreate, Agent\n'),
    file('tools:\n'),
    file('tools: ""\n'),
    { code: '# No frontmatter\n', filename: local },
    { code: '---\nname: [unclosed\n---\n', filename: local },
    file('tools: CronCreate\n', 'docs/a.md'),
    file('tools: Agent\n', 'docs/a.md'),
  ],
  invalid: [
    {
      ...file('tools: Read, CronCreate\n'),
      errors: [
        {
          messageId: 'background',
          data: { tool: 'CronCreate' },
          line: 4,
          column: 14,
          endLine: 4,
          endColumn: 24,
        },
      ],
    },
    // `background: false` and an empty value do not set the background.
    {
      ...file('background: false\ntools: CronCreate\n'),
      errors: [{ messageId: 'background', data: { tool: 'CronCreate' }, line: 5 }],
    },
    {
      ...file('background: off\ntools: CronCreate\n'),
      errors: [{ messageId: 'background', data: { tool: 'CronCreate' } }],
    },
    {
      ...file('background:\ntools: CronCreate\n'),
      errors: [{ messageId: 'background', data: { tool: 'CronCreate' } }],
    },
    // A specifier does not change the tool, and the list form reports each entry.
    {
      ...file('tools:\n  - Read\n  - CronCreate(x)\n  - ListAgents\n'),
      errors: [
        { messageId: 'background', data: { tool: 'CronCreate' }, line: 6 },
        { messageId: 'background', data: { tool: 'ListAgents' }, line: 7 },
      ],
    },
    {
      ...file('tools: CronCreate\n', pluginAgent()),
      errors: [{ messageId: 'background', data: { tool: 'CronCreate' } }],
    },
    // Each built-in tool outside the background set that a subagent can keep.
    {
      ...file(
        'tools: CronDelete, CronList, ListMcpResourcesTool, PushNotification, ReadMcpResourceTool, RemoteTrigger, ReportFindings, SendFeedback, SendUserFile, ShareOnboardingGuide, TaskCreate, TaskGet, TaskList, TaskOutput, TaskUpdate\n',
      ),
      errors: Array.from({ length: 15 }, () => ({ messageId: 'background' as const })),
    },
    // A list of `Agent` alone.
    {
      ...file('tools: Agent\n'),
      errors: [{ messageId: 'onlyAgent', line: 4, column: 8, endColumn: 13 }],
    },
    { ...file('tools: Agent(worker, researcher)\n'), errors: [{ messageId: 'onlyAgent' }] },
    { ...file('tools: Task\n'), errors: [{ messageId: 'onlyAgent' }] },
    { ...file('tools: Task(x), Agent\n'), errors: [{ messageId: 'onlyAgent', column: 8 }] },
    { ...file('tools:\n  - Agent\n'), errors: [{ messageId: 'onlyAgent', line: 5 }] },
    { ...file('background: true\ntools: Agent\n'), errors: [{ messageId: 'onlyAgent' }] },
    { ...file('tools: Agent\n', pluginAgent()), errors: [{ messageId: 'onlyAgent' }] },
  ],
})
