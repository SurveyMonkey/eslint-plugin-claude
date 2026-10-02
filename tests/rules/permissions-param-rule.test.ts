// The permissions page, "Match by input parameter": a `Tool(param:value)`
// rule cannot match the primary field of the tool.
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('permissions-param-rule')
const settings = (permissions: unknown) => JSON.stringify({ permissions })

jsonTester.run('permissions-param-rule', rule, {
  valid: [
    // The examples of the docs.
    {
      code: settings({
        deny: [
          'Agent(model:opus)',
          'Agent(isolation:worktree)',
          'Bash(run_in_background:true)',
          'Agent(isolation:*)',
        ],
      }),
      filename: '.claude/settings.json',
    },
    {
      code: settings({ ask: ['Skill(skill:deploy)', 'Agent( model : opus )'] }),
      filename: '.claude/settings.local.json',
    },
    // The rules that the docs give in place of a primary-field rule.
    {
      code: settings({ deny: ['Bash(rm *)', 'Read(./path)', 'WebFetch(domain:host)'] }),
      filename: '.claude/settings.json',
    },
    // A field that is not primary for this tool.
    {
      code: settings({
        deny: ['Read(path:x)', 'Grep(file_path:x)', 'Bash(file_path:x)', 'Bogus(command:x)'],
      }),
      filename: '.claude/settings.json',
    },
    // The `:*` suffix of a command pattern has no primary field.
    {
      code: settings({ deny: ['Bash(git:*)', 'Bash(command)'] }),
      filename: '.claude/settings.json',
    },
    // An allow rule uses the specifier of its tool.
    {
      code: settings({ allow: ['Bash(command:rm *)', 'WebFetch(url:x)'] }),
      filename: '.claude/settings.json',
    },
    // A rule that does not parse is for `permissions-rule-syntax`.
    {
      code: settings({ deny: ['Bash(command:x', 'Bash(command:x) y'] }),
      filename: '.claude/settings.json',
    },
    { code: JSON.stringify({ deny: ['Bash(command:x)'] }), filename: '.claude/settings.json' },
    // A bare name has no parameter.
    { code: settings({ deny: ['Bash'] }), filename: '.claude/settings.json' },
  ],
  invalid: [
    {
      code: settings({ deny: ['Bash(command:rm *)'] }),
      filename: '.claude/settings.json',
      errors: [
        {
          messageId: 'primaryField',
          data: { tool: 'Bash', field: 'command' },
          line: 1,
          column: 25,
        },
      ],
    },
    // The primary field of each tool in the docs.
    {
      code: settings({
        deny: [
          'PowerShell(command:x)',
          'Read(file_path:x)',
          'Edit(file_path:x)',
          'Write(file_path:x)',
        ],
        ask: ['Grep(path:x)', 'Glob(path:x)', 'NotebookEdit(notebook_path:x)', 'WebFetch(url:x)'],
      }),
      filename: '.claude/settings.local.json',
      errors: [
        { messageId: 'primaryField', data: { tool: 'PowerShell', field: 'command' } },
        { messageId: 'primaryField', data: { tool: 'Read', field: 'file_path' } },
        { messageId: 'primaryField', data: { tool: 'Edit', field: 'file_path' } },
        { messageId: 'primaryField', data: { tool: 'Write', field: 'file_path' } },
        { messageId: 'primaryField', data: { tool: 'Grep', field: 'path' } },
        { messageId: 'primaryField', data: { tool: 'Glob', field: 'path' } },
        { messageId: 'primaryField', data: { tool: 'NotebookEdit', field: 'notebook_path' } },
        { messageId: 'primaryField', data: { tool: 'WebFetch', field: 'url' } },
      ],
    },
    // Whitespace around the colon is ignored.
    {
      code: settings({ deny: ['Bash( command : rm)'] }),
      filename: '.claude/settings.json',
      errors: [{ messageId: 'primaryField' }],
    },
  ],
})
