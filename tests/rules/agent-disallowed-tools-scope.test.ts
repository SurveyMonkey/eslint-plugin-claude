// The sub-agents page, "Available tools": an entry of `disallowedTools` with a
// specifier, such as `Bash(git push *)`, "still removes the whole tool". If
// both fields are set, "a tool listed in both is removed".
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const local = '.claude/agents/a.md'
const file = (fields: string, filename = local) => ({
  code: `---\nname: a\ndescription: d\n${fields}---\n\nBody.\n`,
  filename,
})

markdownTester.run('agent-disallowed-tools-scope', ruleOf('agent-disallowed-tools-scope'), {
  valid: [
    file('disallowedTools: Write, Edit\n'),
    file('tools: Read, Grep\ndisallowedTools: Write, Edit\n'),
    // A specifier in `tools` is for agent-tools-known, and `Agent(type)` lists a type.
    file('tools: Bash(git status), Agent(worker)\n'),
    // The server pattern of `disallowedTools` is a whole-server entry, not a specifier.
    file('disallowedTools: mcp__github, mcp__*\n'),
    // A tool name that only starts like the other one.
    file('tools: Bash\ndisallowedTools: PowerShell, BashOutput\n'),
    file('tools: mcp__github__search\ndisallowedTools: mcp__github\n'),
    // An entry that does not parse, and a field with no value.
    file('tools: Read(\ndisallowedTools: Read(\n'),
    file('disallowedTools:\n'),
    file('tools: Read\ndisallowedTools:\n'),
    { code: '# No frontmatter\n', filename: local },
    { code: '---\nname: [unclosed\n---\n', filename: local },
    file('disallowedTools: Bash(git push *)\n', 'docs/a.md'),
  ],
  invalid: [
    {
      ...file('disallowedTools: Bash(git push *)\n'),
      errors: [
        {
          messageId: 'specifier',
          data: { entry: 'Bash(git push *)', tool: 'Bash' },
          line: 4,
          column: 18,
          endLine: 4,
          endColumn: 34,
        },
      ],
    },
    // The list form, a plugin agent, and each entry of a string.
    {
      ...file('disallowedTools:\n  - Write\n  - Edit(docs/**)\n', pluginAgent()),
      errors: [{ messageId: 'specifier', data: { entry: 'Edit(docs/**)', tool: 'Edit' }, line: 6 }],
    },
    {
      ...file('disallowedTools: Read(.env), Bash(rm *), Write\n'),
      errors: [
        { messageId: 'specifier', data: { entry: 'Read(.env)', tool: 'Read' } },
        { messageId: 'specifier', data: { entry: 'Bash(rm *)', tool: 'Bash' } },
      ],
    },
    // A type list in `disallowedTools` removes the whole `Agent` tool.
    {
      ...file('disallowedTools: Agent(worker)\n'),
      errors: [{ messageId: 'specifier', data: { entry: 'Agent(worker)', tool: 'Agent' } }],
    },
    // A tool in both lists.
    {
      ...file('tools: Read, Write\ndisallowedTools: Write\n'),
      errors: [{ messageId: 'both', data: { tool: 'Write' }, line: 4, column: 14, endColumn: 19 }],
    },
    {
      ...file('tools: Read, Write, Edit\ndisallowedTools: Edit, Write\n'),
      errors: [
        { messageId: 'both', data: { tool: 'Write' }, line: 4 },
        { messageId: 'both', data: { tool: 'Edit' }, line: 4 },
      ],
    },
    {
      ...file('tools:\n  - Bash\ndisallowedTools: Bash\n', pluginAgent()),
      errors: [{ messageId: 'both', data: { tool: 'Bash' }, line: 5 }],
    },
    {
      ...file('tools: mcp__github\ndisallowedTools: mcp__github\n'),
      errors: [{ messageId: 'both', data: { tool: 'mcp__github' } }],
    },
    // A type list in `tools` names the tool too.
    {
      ...file('tools: Agent(worker), Read\ndisallowedTools: Agent\n'),
      errors: [{ messageId: 'both', data: { tool: 'Agent' }, line: 4 }],
    },
    // `Task` is the old name of `Agent`, in either field.
    {
      ...file('tools: Agent, Read\ndisallowedTools: Task\n'),
      errors: [{ messageId: 'both', data: { tool: 'Agent' }, line: 4 }],
    },
    {
      ...file('tools: Task, Read\ndisallowedTools: Agent\n'),
      errors: [{ messageId: 'both', data: { tool: 'Task' }, line: 4 }],
    },
    // A specifier names the tool too, so the tool is in both lists.
    {
      ...file('tools: Bash\ndisallowedTools: Bash(git push *)\n'),
      errors: [
        { messageId: 'both', data: { tool: 'Bash' }, line: 4 },
        { messageId: 'specifier', data: { entry: 'Bash(git push *)', tool: 'Bash' }, line: 5 },
      ],
    },
  ],
})
