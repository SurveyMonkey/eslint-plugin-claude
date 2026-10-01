// `EndConversation` stays in the pool while any other tool does, and a listed
// `AskUserQuestion` is not auto-allowed. The docs name no other interactive tool.
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const skill = '.claude/skills/s/SKILL.md'
const file = (fields: string, filename = skill) => ({
  code: `---\n${fields}---\n\n# S\n`,
  filename,
})

markdownTester.run('skill-allowed-tools-ineffective', ruleOf('skill-allowed-tools-ineffective'), {
  valid: [
    file('allowed-tools: Read Grep\n'),
    file('disallowed-tools: AskUserQuestion\n'),
    file('allowed-tools: EndConversation\n'),
    file('disallowed-tools: [Bash, AskUserQuestion]\n'),
    file('description: d\n'),
    // A name that holds the tool name, and a tool name inside a rule.
    file('allowed-tools: AskUserQuestionX Bash(echo AskUserQuestion)\n'),
    file('allowed-tools: Bash(echo, AskUserQuestion )\n'),
    file('allowed-tools: 3\n'),
    file('allowed-tools: [3, Read]\n'),
    file('allowed-tools:\n'),
    { code: '# No frontmatter\n', filename: skill },
    file('allowed-tools: [unclosed\n'),
    file('allowed-tools: AskUserQuestion\n', 'docs/SKILL.md'),
  ],
  invalid: [
    {
      ...file('allowed-tools: AskUserQuestion\n'),
      errors: [
        {
          messageId: 'ineffective',
          data: { tool: 'AskUserQuestion', field: 'allowed-tools' },
          line: 2,
          column: 16,
          endColumn: 31,
        },
      ],
    },
    {
      ...file('disallowed-tools: EndConversation\n', '.claude/commands/c.md'),
      errors: [
        { messageId: 'ineffective', data: { tool: 'EndConversation', field: 'disallowed-tools' } },
      ],
    },
    {
      ...file('allowed-tools: Read, AskUserQuestion, Grep\n'),
      errors: [{ messageId: 'ineffective' }],
    },
    { ...file('allowed-tools: Read AskUserQuestion(x)\n'), errors: [{ messageId: 'ineffective' }] },
    {
      ...file('allowed-tools:\n  - Bash(git add *)\n  - AskUserQuestion\n'),
      errors: [{ messageId: 'ineffective', line: 3 }],
    },
    {
      ...file('allowed-tools: [AskUserQuestion]\ndisallowed-tools: Read, EndConversation\n'),
      errors: [
        { messageId: 'ineffective', data: { tool: 'AskUserQuestion', field: 'allowed-tools' } },
        { messageId: 'ineffective', data: { tool: 'EndConversation', field: 'disallowed-tools' } },
      ],
    },
  ],
})
