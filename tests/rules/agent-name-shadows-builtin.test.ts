// The sub-agents page, "Built-in subagents": a project or user subagent named
// `Explore` overrides the built-in. The page lists six built-in names. A plugin
// agent has a scoped name, so the rule checks local agents only.
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const local = '.claude/agents/a.md'
const file = (name: string, filename = local) => ({
  code: `---\nname: ${name}\ndescription: d\n---\n\nBody.\n`,
  filename,
})

markdownTester.run('agent-name-shadows-builtin', ruleOf('agent-name-shadows-builtin'), {
  valid: [
    file('reviewer'),
    // A near miss: the match is exact and case-sensitive.
    file('explore'),
    file('Explorer'),
    file('general'),
    file('Claude'),
    file('plan'),
    // An intended override, from the allow option.
    { ...file('Explore'), options: [{ allow: ['Explore'] }] },
    { ...file('Plan'), options: [{ allow: ['Explore', 'Plan'] }] },
    // A plugin agent has a scoped name, so it cannot shadow a built-in.
    file('Explore', pluginAgent()),
    // A name that is not a string, or no name, is for agent-frontmatter-valid and the schema rule.
    file('[Explore]'),
    file('123'),
    { code: '---\ndescription: d\n---\n', filename: local },
    { code: '---\nname:\ndescription: d\n---\n', filename: local },
    { code: '---\nname: [unclosed\n---\n', filename: local },
    { code: '# Explore\n', filename: local },
    file('Explore', 'docs/a.md'),
  ],
  invalid: [
    {
      ...file('Explore'),
      errors: [
        {
          messageId: 'shadows',
          data: { name: 'Explore' },
          line: 2,
          column: 7,
          endLine: 2,
          endColumn: 14,
        },
      ],
    },
    // Each built-in name on the sub-agents page.
    ...['Plan', 'general-purpose', 'claude', 'statusline-setup', 'claude-code-guide'].map(
      (name) => ({ ...file(name), errors: [{ messageId: 'shadows' as const, data: { name } }] }),
    ),
    // A subfolder does not change the name.
    {
      ...file('Explore', '.claude/agents/review/a.md'),
      errors: [{ messageId: 'shadows', data: { name: 'Explore' } }],
    },
    // An allow entry for another name does not allow this one.
    {
      ...file('Plan'),
      options: [{ allow: ['Explore'] }],
      errors: [{ messageId: 'shadows', data: { name: 'Plan' } }],
    },
    // A quoted name is the same name.
    {
      ...file('"Explore"'),
      errors: [{ messageId: 'shadows', data: { name: 'Explore' }, column: 7, endColumn: 16 }],
    },
  ],
})
