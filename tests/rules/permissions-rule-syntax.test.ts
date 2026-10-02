// Each valid form is from the permissions page, "Permission rule syntax".
import { json5Tester, jsonTester, ruleOf } from '../rule-tester.test-support.ts'

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
