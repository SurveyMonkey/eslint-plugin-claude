// The permissions page, "Read and Edit": Claude Code checks file permissions
// against `Edit(path)` and `Read(path)` rules only. The error reference
// names `Write`, `NotebookEdit`, `MultiEdit` and `Glob`.
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('permissions-path-rule-tool')
const settings = (permissions: unknown) => JSON.stringify({ permissions })

jsonTester.run('permissions-path-rule-tool', rule, {
  valid: [
    {
      code: settings({ allow: ['Edit(docs/**)', 'Read(docs/**)'], deny: ['Read(./.env)'] }),
      filename: '.claude/settings.json',
    },
    // The docs say to leave a bare name alone.
    {
      code: settings({ allow: ['Write', 'NotebookEdit', 'MultiEdit', 'Glob'], deny: ['Write'] }),
      filename: '.claude/settings.json',
    },
    // The docs name no replacement for `Grep` and `LSP`.
    {
      code: settings({ allow: ['Grep(src/**)', 'LSP(src/**)'] }),
      filename: '.claude/settings.json',
    },
    // A deny or ask parameter rule is for `permissions-param-rule`.
    {
      code: settings({ deny: ['Write(file_path:x)', 'Glob(path:x)'] }),
      filename: '.claude/settings.local.json',
    },
    // A rule that does not parse is for `permissions-rule-syntax`.
    { code: settings({ allow: ['Write(', 'Write(a) b'] }), filename: '.claude/settings.json' },
    { code: JSON.stringify({ allow: ['Write(a)'] }), filename: '.claude/settings.json' },
  ],
  invalid: [
    {
      code: settings({ allow: ['Write(docs/**)'] }),
      filename: '.claude/settings.json',
      errors: [
        {
          messageId: 'neverConsulted',
          data: { tool: 'Write', replacement: 'Edit' },
          line: 1,
          column: 26,
        },
      ],
    },
    {
      code: settings({
        deny: ['NotebookEdit(docs/**)', 'MultiEdit(docs/**)'],
        ask: ['Glob(docs/**)'],
      }),
      filename: '.claude/settings.local.json',
      errors: [
        { messageId: 'neverConsulted', data: { tool: 'NotebookEdit', replacement: 'Edit' } },
        { messageId: 'neverConsulted', data: { tool: 'MultiEdit', replacement: 'Edit' } },
        { messageId: 'neverConsulted', data: { tool: 'Glob', replacement: 'Read' } },
      ],
    },
    // An allow rule has no parameter form.
    {
      code: settings({ allow: ['Write(file_path:x)'] }),
      filename: '.claude/settings.json',
      errors: [{ messageId: 'neverConsulted' }],
    },
  ],
})
