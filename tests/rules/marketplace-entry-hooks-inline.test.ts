// The rule reads the `hooks` of each entry in `plugins` in
// `.claude-plugin/marketplace.json`. The files glob and the decoy files are in
// tests/configs.test.ts.
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('marketplace-entry-hooks-inline')
const filename = '.claude-plugin/marketplace.json'
const manifest = (...plugins: unknown[]) => JSON.stringify({ name: 'acme', plugins })
const inline = { PostToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'fmt' }] }] }

jsonTester.run('marketplace-entry-hooks-inline (valid)', rule, {
  valid: [
    { code: manifest({ name: 'p', source: './p', hooks: inline }), filename },
    { code: manifest({ name: 'p', source: './p', hooks: {} }), filename },
    { code: manifest({ name: 'p', source: './p' }), filename },
    // A path or an array in `plugin.json` is valid there. Only the entry is read.
    { code: JSON.stringify({ name: 'acme', hooks: './hooks.json', plugins: [] }), filename },
    // A value that is not a string, an array or an object is for the schema rule.
    { code: manifest({ name: 'p', hooks: 3 }), filename },
    { code: manifest({ name: 'p', hooks: null }), filename },
    { code: manifest({ name: 'p', hooks: true }), filename },
    { code: manifest('p', null, 3, ['./hooks.json']), filename },
    { code: JSON.stringify({ name: 'acme', plugins: { hooks: './h.json' } }), filename },
    { code: JSON.stringify({ name: 'acme' }), filename },
    { code: '[]', filename },
    // Two `hooks` keys. The rule reads the last, as `JSON.parse` does.
    { code: '{"plugins": [{"hooks": "./h.json", "hooks": {}}]}', filename },
  ],
  invalid: [],
})

jsonTester.run('marketplace-entry-hooks-inline (invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: manifest({ name: 'p', source: './p', hooks: './hooks/hooks.json' }),
      filename,
      errors: [{ messageId: 'string', line: 1, column: 62, endColumn: 82 }],
    },
    { code: manifest({ name: 'p', hooks: '' }), filename, errors: [{ messageId: 'string' }] },
    {
      code: manifest({ name: 'p', source: './p', hooks: [inline] }),
      filename,
      errors: [{ messageId: 'array' }],
    },
    { code: manifest({ name: 'p', hooks: [] }), filename, errors: [{ messageId: 'array' }] },
    {
      code: manifest({ name: 'p', hooks: ['./h.json'] }),
      filename,
      errors: [{ messageId: 'array' }],
    },
    // Each entry reports on its own `hooks`.
    {
      code: manifest(
        { name: 'a', hooks: './a.json' },
        { name: 'b', hooks: inline },
        { name: 'c', hooks: [] },
      ),
      filename,
      errors: [{ messageId: 'string' }, { messageId: 'array' }],
    },
    // Two `hooks` keys. `JSON.parse` keeps the last.
    {
      code: '{"plugins": [{"hooks": {}, "hooks": "./h.json"}]}',
      filename,
      errors: [{ messageId: 'string' }],
    },
  ],
})
