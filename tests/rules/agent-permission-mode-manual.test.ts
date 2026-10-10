// The sub-agents page, "Permission modes": `manual` is an alias for `default`,
// and the page says to write the config value. Claude Code ignores
// `permissionMode` in a plugin agent, so the rule checks local agents only.
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const local = '.claude/agents/a.md'
const file = (mode: string, filename = local) => ({
  code: `---\nname: a\ndescription: d\npermissionMode: ${mode}\n---\n\nBody.\n`,
  filename,
})

markdownTester.run('agent-permission-mode-manual', ruleOf('agent-permission-mode-manual'), {
  valid: [
    file('default'),
    // The other documented values are not the alias.
    ...['acceptEdits', 'auto', 'dontAsk', 'bypassPermissions', 'plan'].map((mode) => file(mode)),
    // The match is exact and case-sensitive. `agent-frontmatter-schema` reports other values.
    file('Manual'),
    file('manually'),
    file('[manual]'),
    // Claude Code ignores the field in a plugin agent.
    file('manual', pluginAgent()),
    // A file outside the agent folders.
    file('manual', 'docs/a.md'),
    { code: '---\nname: a\ndescription: d\n---\n', filename: local },
    { code: '---\nname: a\npermissionMode:\n---\n', filename: local },
    { code: '---\npermissionMode: [manual\n---\n', filename: local },
    { code: 'permissionMode: manual\n', filename: local },
  ],
  invalid: [
    {
      ...file('manual'),
      errors: [
        {
          messageId: 'manual',
          line: 4,
          column: 17,
          endLine: 4,
          endColumn: 23,
          suggestions: [
            {
              messageId: 'useDefault',
              output: '---\nname: a\ndescription: d\npermissionMode: default\n---\n\nBody.\n',
            },
          ],
        },
      ],
    },
    // A subfolder does not change the scope.
    {
      ...file('manual', '.claude/agents/review/a.md'),
      errors: [
        {
          messageId: 'manual',
          suggestions: [{ messageId: 'useDefault', output: file('default').code }],
        },
      ],
    },
    // A quoted value is the same value. The suggestion replaces the quotes too.
    {
      ...file('"manual"'),
      errors: [
        {
          messageId: 'manual',
          column: 17,
          endColumn: 25,
          suggestions: [{ messageId: 'useDefault', output: file('default').code }],
        },
      ],
    },
  ],
})
