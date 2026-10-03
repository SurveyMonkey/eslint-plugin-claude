// The sub-agents page, "Available tools" and "Restrict which subagents can be
// spawned": `tools` and `disallowedTools` take tool names, `Agent(type)`, and
// MCP patterns. `mcp__*` and a specifier are for `disallowedTools`. The
// errors page, "Agent would be spawned with zero tools", names an unrecognized
// entry, with `Grpe` for `Grep` as its example.
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const agent = '.claude/agents/a.md'
const file = (fields: string, filename = agent) => ({
  code: `---\nname: a\ndescription: d\n${fields}---\n\nBody\n`,
  filename,
})

markdownTester.run('agent-tools-known', ruleOf('agent-tools-known'), {
  valid: [
    // The examples of the docs.
    file('tools: Read, Glob, Grep\n'),
    file('tools: Read, Grep, Glob, Bash\n'),
    file('disallowedTools: Write, Edit\n'),
    file('disallowedTools: mcp__github\n'),
    file('tools: Agent(worker, researcher), Read, Bash\n'),
    file('tools: Agent, Read, Bash\n'),
    file('tools: Task(worker), Read\n'),
    // The MCP forms.
    file('tools: mcp__s, mcp__s__*, mcp__s__t\n'),
    file('disallowedTools: mcp__s__*\n'),
    // Only `disallowedTools` takes a specifier, and `mcp__*`.
    file('disallowedTools: Bash(git push *), mcp__*\n'),
    // The list form.
    file('tools:\n  - Read\n  - Agent(a, b)\n  - mcp__s__*\n'),
    file('disallowedTools: [Write, "Bash(git push *)"]\n'),
    // An empty list gives no report, and so does a field of another type.
    file('tools:\n'),
    file('tools: ""\n'),
    file('tools: []\n'),
    file('tools: 3\n'),
    file('tools: [3, Read]\n'),
    file('tools: Read,, Grep,\n'),
    file('description: d\n'),
    file('tools: Bogus\n', 'docs/a.md'),
    { code: '# No frontmatter\n', filename: agent },
    file('tools: [unclosed\n'),
    // A plugin agent has the same tool lists.
    file('tools: Read, Grep\n', pluginAgent()),
  ],
  invalid: [
    {
      ...file('tools: Read, Grpe\n'),
      errors: [
        { messageId: 'unknown', data: { tool: 'Grpe' }, line: 4, column: 14, endColumn: 18 },
      ],
    },
    // The names are case-sensitive.
    { ...file('tools: read\n'), errors: [{ messageId: 'unknown', data: { tool: 'read' } }] },
    {
      ...file('disallowedTools: Bogus(x)\n'),
      errors: [{ messageId: 'unknown', data: { tool: 'Bogus' }, line: 4, column: 18 }],
    },
    // `mcp__*` is for `disallowedTools`.
    {
      ...file('tools: Read, mcp__*\n'),
      errors: [{ messageId: 'anyMcp', line: 4, column: 14, endColumn: 20 }],
    },
    // A specifier is for `disallowedTools`.
    {
      ...file('tools: Bash(git push *)\n'),
      errors: [
        {
          messageId: 'specifier',
          data: { entry: 'Bash(git push *)' },
          line: 4,
          column: 8,
          endColumn: 24,
        },
      ],
    },
    {
      ...file('tools: Read, mcp__s__t(x), WebSearch(q)\n'),
      errors: [
        { messageId: 'specifier', data: { entry: 'mcp__s__t(x)' } },
        { messageId: 'specifier', data: { entry: 'WebSearch(q)' } },
      ],
    },
    // An entry that does not parse.
    {
      ...file('tools: Read(\n'),
      errors: [{ messageId: 'malformed', data: { entry: 'Read(' } }],
    },
    {
      ...file('disallowedTools: (x)\n'),
      errors: [{ messageId: 'malformed', data: { entry: '(x)' } }],
    },
    // The list form reports at the entry.
    {
      ...file('tools:\n  - Read\n  - Grpe\n'),
      errors: [{ messageId: 'unknown', line: 6, column: 5, endColumn: 9 }],
    },
    // Both fields, and a plugin agent.
    {
      ...file('tools: Bogus\ndisallowedTools: Other\n', pluginAgent()),
      errors: [
        { messageId: 'unknown', data: { tool: 'Bogus' }, line: 4 },
        { messageId: 'unknown', data: { tool: 'Other' }, line: 5 },
      ],
    },
    // The commas inside parentheses do not split an entry.
    {
      ...file('tools: Read, Agent(a, b), Bogus\n'),
      errors: [{ messageId: 'unknown', column: 27 }],
    },
  ],
})
