// Each valid form is from the permissions page, "Permission rule syntax".
import { pluginSkill } from '../plugin-fixture.test-support.ts'
import { json5Tester, jsonTester, markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('permissions-rule-syntax')
const settings = (permissions: unknown) => JSON.stringify({ permissions })
const allow = (...rules: string[]) => settings({ allow: rules })

jsonTester.run('permissions-rule-syntax', rule, {
  valid: [
    {
      code: allow('Bash', 'Bash(npm run *)', 'WebFetch(domain:example.com)', 'mcp__a__*'),
      filename: '.claude/settings.json',
    },
    // Parentheses inside a specifier are literal.
    { code: allow('Edit(./Finance (2024)/**)'), filename: '.claude/settings.json' },
    { code: JSON.stringify({ model: 'x' }), filename: '.claude/settings.json' },
    { code: '[]', filename: '.claude/settings.json' },
    { code: settings([]), filename: '.claude/settings.json' },
    { code: settings({ allow: 'Bash(' }), filename: '.claude/settings.json' },
    // An entry that is not a string is for another rule.
    {
      code: settings({ allow: [1, null, ['Bash('], { a: 1 }] }),
      filename: '.claude/settings.json',
    },
    { code: settings({ defaultMode: 'Bash(' }), filename: '.claude/settings.json' },
    // The other keys of the file hold no rule.
    { code: JSON.stringify({ env: { A: 'Bash(' } }), filename: '.claude/settings.json' },
  ],
  invalid: [
    {
      code: allow('Bash', '(npm run *)'),
      filename: '.claude/settings.json',
      errors: [{ messageId: 'emptyTool', line: 1, column: 33 }],
    },
    {
      code: allow(''),
      filename: '.claude/settings.local.json',
      errors: [{ messageId: 'emptyTool' }],
    },
    {
      code: allow('Bash(npm run build'),
      filename: '.claude/settings.json',
      errors: [{ messageId: 'unbalanced' }],
    },
    {
      code: allow('Bash)'),
      filename: '.claude/settings.json',
      errors: [{ messageId: 'unbalanced' }],
    },
    {
      code: allow('Bash(npm run build) --watch'),
      filename: '.claude/settings.json',
      errors: [{ messageId: 'trailingText' }],
    },
    {
      code: allow('Bash\u0000'),
      filename: '.claude/settings.json',
      errors: [{ messageId: 'nulByte' }],
    },
    // Each list is read, and each bad entry gets one report.
    {
      code: settings({ allow: ['Bash('], ask: ['Read(a'], deny: ['(x)', 'Bash'] }),
      filename: 'packages/x/.claude/settings.json',
      errors: [
        { messageId: 'unbalanced' },
        { messageId: 'unbalanced' },
        { messageId: 'emptyTool' },
      ],
    },
    // Two `permissions` keys. The rule reads the last, as `JSON.parse` does.
    {
      code: '{"permissions": {"allow": ["Bash"]}, "permissions": {"allow": ["Bash("]}}',
      filename: '.claude/settings.json',
      errors: [{ messageId: 'unbalanced' }],
    },
  ],
})

json5Tester.run('permissions-rule-syntax (JSON5)', rule, {
  valid: [{ code: "{ permissions: { allow: ['Bash(npm *)'] } }" }],
  invalid: [
    {
      code: "{ permissions: { deny: ['Bash('] } }",
      errors: [{ messageId: 'unbalanced' }],
    },
  ],
})

// The skills page, "Pre-approve tools for a skill": `allowed-tools` is an
// allow list, and `disallowed-tools` is a deny list. Each takes a string or a
// YAML list.
const skill = (fields: string, filename = '.claude/skills/s/SKILL.md') => ({
  code: `---\n${fields}---\n\n# S\n`,
  filename,
})

markdownTester.run('permissions-rule-syntax in skill files', rule, {
  valid: [
    skill('allowed-tools: Bash Bash(npm run *) WebFetch(domain:example.com) mcp__a__*\n'),
    // Parentheses inside a specifier are literal.
    skill('allowed-tools: Edit(./Finance (2024)/**)\n'),
    skill('allowed-tools: Read,Grep\n'),
    skill('allowed-tools:\n  - Read\n  - Grep\n'),
    skill('allowed-tools: 3\n'),
    skill('allowed-tools: [3, null, [Read(], {a: 1}]\n'),
    skill('description: Bash(\n'),
    skill('allowed-tools:\n'),
    skill('allowed-tools: Bash(\n', 'docs/SKILL.md'),
    { code: '# No frontmatter\n', filename: '.claude/skills/s/SKILL.md' },
    skill('allowed-tools: [unclosed\n'),
  ],
  invalid: [
    {
      ...skill('allowed-tools: Read Bash(git add *\n'),
      errors: [{ messageId: 'unbalanced', line: 2, column: 21, endColumn: 35 }],
    },
    {
      ...skill('disallowed-tools:\n  - (x)\n  - Read(a)b\n', '.claude/commands/c.md'),
      errors: [
        { messageId: 'emptyTool', line: 3, column: 5, endColumn: 8 },
        { messageId: 'trailingText', line: 4, column: 5, endColumn: 13 },
      ],
    },
    {
      ...skill('allowed-tools: [Read(a)b, "Bash\\0"]\n', pluginSkill()),
      // The NUL byte is an escape in the text, so its report covers the whole list item.
      errors: [
        { messageId: 'trailingText', column: 17, endColumn: 25 },
        { messageId: 'nulByte', column: 27, endColumn: 35 },
      ],
    },
    // A stray closing parenthesis ends nothing: the rule reads as one string.
    {
      ...skill('allowed-tools: Read) Grep\n'),
      errors: [{ messageId: 'unbalanced', column: 16, endColumn: 21 }],
    },
  ],
})
