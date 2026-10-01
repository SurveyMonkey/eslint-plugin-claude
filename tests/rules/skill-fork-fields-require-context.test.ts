// `agent` and `background` need `context: fork`. Without it, Claude Code
// ignores both.
import { pluginSkill } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const skill = '.claude/skills/s/SKILL.md'
const command = '.claude/commands/c.md'
const file = (fields: string, filename = skill) => ({
  code: `---\n${fields}---\n\n# S\n`,
  filename,
})

markdownTester.run(
  'skill-fork-fields-require-context',
  ruleOf('skill-fork-fields-require-context'),
  {
    valid: [
      file('context: fork\nagent: Explore\nbackground: false\n'),
      file('context: fork\n'),
      file('description: d\n'),
      // An empty value is an absent field.
      file('agent:\nbackground:\n'),
      file('agent: Explore\ncontext: fork\n', command),
      { code: '# No frontmatter\n', filename: skill },
      file('agent: [unclosed\n'),
      file('agent: Explore\n', 'docs/SKILL.md'),
    ],
    invalid: [
      {
        ...file('agent: Explore\n'),
        errors: [
          { messageId: 'needsFork', data: { key: 'agent' }, line: 2, column: 1, endColumn: 6 },
        ],
      },
      {
        ...file('background: false\n'),
        errors: [{ messageId: 'needsFork', data: { key: 'background' }, line: 2 }],
      },
      {
        ...file('context: inline\nagent: Plan\nbackground: true\n'),
        errors: [
          { messageId: 'needsFork', data: { key: 'agent' }, line: 3 },
          { messageId: 'needsFork', data: { key: 'background' }, line: 4 },
        ],
      },
      {
        ...file('agent: Explore\n', command),
        errors: [{ messageId: 'needsFork', data: { key: 'agent' } }],
      },
      // A plugin skill is checked too.
      {
        ...file('agent: Explore\n', pluginSkill()),
        errors: [{ messageId: 'needsFork', data: { key: 'agent' } }],
      },
    ],
  },
)
