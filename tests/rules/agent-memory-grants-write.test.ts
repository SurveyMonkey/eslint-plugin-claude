// `memory` turns on Read, Write and Edit. The rule reports a `tools` list that
// leaves out Write or Edit. Local and plugin agents both take `memory`.
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const local = '.claude/agents/a.md'
const file = (frontmatter: string, filename = local) => ({
  code: `---\nname: a\ndescription: d\n${frontmatter}---\n\nBody.\n`,
  filename,
})

markdownTester.run('agent-memory-grants-write', ruleOf('agent-memory-grants-write'), {
  valid: [
    file('memory: project\ntools: Read, Write, Edit\n'),
    file('memory: user\ntools: [Read, Write, Edit]\n'),
    // A specifier does not change the tool name.
    file('memory: local\ntools: Write(docs/**), Edit(docs/**)\n'),
    // `tools` inherits every tool when it is absent or has no value.
    file('memory: project\n'),
    file('memory: project\ntools:\n'),
    // No memory, or a scope that the docs do not list.
    file('tools: Read, Grep\n'),
    file('memory: team\ntools: Read\n'),
    file('memory:\ntools: Read\n'),
    // A value that is not a string or a list is for `agent-frontmatter-schema`.
    file('memory: project\ntools: 5\n'),
    file('memory: project\ntools: [Read, 5]\n'),
    file('memory: project\ntools: Read\n', 'docs/agents/a.md'),
    file('memory: project\ntools: [unclosed\n'),
  ],
  invalid: [
    {
      ...file('memory: project\ntools: Read, Grep\n'),
      errors: [
        {
          messageId: 'grantsWrite',
          data: { missing: '`Write` and `Edit`' },
          line: 5,
          column: 8,
          endColumn: 18,
        },
      ],
    },
    {
      ...file('memory: user\ntools:\n  - Read\n  - Grep\n'),
      errors: [{ messageId: 'grantsWrite', data: { missing: '`Write` and `Edit`' } }],
    },
    {
      ...file('memory: local\ntools: [Read, Write]\n'),
      errors: [{ messageId: 'grantsWrite', data: { missing: '`Edit`' } }],
    },
    {
      ...file('memory: local\ntools: Edit, Read\n'),
      errors: [{ messageId: 'grantsWrite', data: { missing: '`Write`' } }],
    },
    {
      ...file('memory: project\ntools: []\n'),
      errors: [{ messageId: 'grantsWrite', data: { missing: '`Write` and `Edit`' } }],
    },
    // A plugin agent takes `memory` and `tools`.
    {
      ...file('memory: project\ntools: Read\n', pluginAgent()),
      errors: [{ messageId: 'grantsWrite' }],
    },
  ],
})
