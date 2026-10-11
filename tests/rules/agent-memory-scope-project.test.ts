// The sub-agents page, "Persistent memory tips": `project` is the
// recommended default scope of `memory`. A local agent and a plugin agent both
// take `memory`.
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const local = '.claude/agents/a.md'
const file = (scope: string, filename = local) => ({
  code: `---\nname: a\ndescription: d\nmemory: ${scope}\n---\n\nBody.\n`,
  filename,
})

markdownTester.run('agent-memory-scope-project', ruleOf('agent-memory-scope-project'), {
  valid: [
    file('project'),
    file('project', pluginAgent()),
    // Another value is for `agent-frontmatter-schema`.
    file('team'),
    file('User'),
    file('[user]'),
    file('1'),
    // No scope.
    { code: '---\nname: a\ndescription: d\n---\n', filename: local },
    { code: '---\nname: a\nmemory:\n---\n', filename: local },
    { code: '---\nmemory: [user\n---\n', filename: local },
    { code: 'memory: user\n', filename: local },
    file('user', 'docs/a.md'),
  ],
  invalid: [
    {
      ...file('user'),
      errors: [
        {
          messageId: 'notProject',
          data: { scope: 'user' },
          line: 4,
          column: 9,
          endLine: 4,
          endColumn: 13,
        },
      ],
    },
    { ...file('local'), errors: [{ messageId: 'notProject', data: { scope: 'local' } }] },
    // A plugin agent takes `memory` too.
    {
      ...file('user', pluginAgent()),
      errors: [{ messageId: 'notProject', data: { scope: 'user' } }],
    },
    {
      ...file('local', pluginAgent('b')),
      errors: [{ messageId: 'notProject', data: { scope: 'local' } }],
    },
    // A subfolder does not change the scope, and a quoted value is the same value.
    {
      ...file('"user"', '.claude/agents/review/a.md'),
      errors: [{ messageId: 'notProject', data: { scope: 'user' }, column: 9, endColumn: 15 }],
    },
  ],
})
