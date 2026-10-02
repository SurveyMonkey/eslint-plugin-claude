// The rule checks local agents only. A plugin agent ignores `permissionMode`,
// and `agent-plugin-ignored-fields` reports it there.
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const local = '.claude/agents/a.md'
const file = (frontmatter: string, filename = local) => ({
  code: `---\nname: a\ndescription: d\n${frontmatter}---\n\nBody.\n`,
  filename,
})

markdownTester.run('agent-permission-mode-bypass', ruleOf('agent-permission-mode-bypass'), {
  valid: [
    file('permissionMode: acceptEdits\n'),
    file('permissionMode: plan\n'),
    file('model: sonnet\n'),
    file('permissionMode:\n'),
    file('permissionMode: bypass\n'),
    file('permissionMode: bypassPermissions\n', pluginAgent()),
    file('permissionMode: bypassPermissions\n', 'docs/agents/a.md'),
    file('permissionMode: [unclosed\n'),
  ],
  invalid: [
    {
      ...file('permissionMode: bypassPermissions\n'),
      errors: [{ messageId: 'bypass', line: 4, column: 17, endColumn: 34 }],
    },
    {
      ...file('permissionMode: "bypassPermissions"\n', '.claude/agents/review/b.md'),
      errors: [{ messageId: 'bypass', line: 4 }],
    },
  ],
})
