// The rule reads each entry of `plugins` in `.claude-plugin/marketplace.json`.
// The files glob and the decoy files are in tests/configs.test.ts.
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('marketplace-command-version-ignored')
const filename = '.claude-plugin/marketplace.json'
const manifest = (...plugins: unknown[]) => JSON.stringify({ name: 'acme', plugins })
const command = { source: 'command', command: 'my-tool claude-plugin-path' }

jsonTester.run('marketplace-command-version-ignored (valid)', rule, {
  valid: [
    { code: manifest({ name: 'p', source: command }), filename },
    // `version` is read for each other source type.
    {
      code: manifest(
        { name: 'a', source: './plugins/a', version: '1.0.0' },
        { name: 'b', source: { source: 'github', repo: 'o/r' }, version: '1.0.0' },
        { name: 'c', source: { source: 'npm', package: 'p', version: '1.0.0' }, version: '1.0.0' },
        { name: 'd', source: { source: 'archive', url: 'https://x.test/a.zip' }, version: '1' },
      ),
      filename,
    },
    // The `version` is in the source object, not in the entry.
    { code: manifest({ name: 'p', source: { ...command, version: '1.0.0' } }), filename },
    // A top-level version, and a version in `metadata`, are not an entry `version`.
    {
      code: JSON.stringify({
        name: 'acme',
        version: '1',
        plugins: [{ name: 'p', source: command }],
      }),
      filename,
    },
    // A value of the wrong type is for the schema rule.
    { code: manifest({ name: 'p', source: command, version: 1 }), filename },
    { code: manifest({ name: 'p', source: command, version: null }), filename },
    { code: manifest({ name: 'p', source: { source: 3 }, version: '1' }), filename },
    { code: manifest({ name: 'p', source: ['command'], version: '1' }), filename },
    { code: manifest('p', null, 3, ['x']), filename },
    { code: JSON.stringify({ name: 'acme', plugins: { name: 'p' } }), filename },
    { code: JSON.stringify({ name: 'acme' }), filename },
    { code: '[]', filename },
    // Two `source` keys. The rule reads the last, as `JSON.parse` does.
    {
      code: `{"plugins": [{"name": "p", "source": ${JSON.stringify(command)}, "source": "./p", "version": "1"}]}`,
      filename,
    },
  ],
  invalid: [],
})

jsonTester.run('marketplace-command-version-ignored (invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: manifest({ name: 'p', source: command, version: '1.0.0' }),
      filename,
      errors: [{ messageId: 'ignored', line: 1, column: 108, endColumn: 125 }],
    },
    // Each entry reports once.
    {
      code: manifest(
        { name: 'a', source: command, version: '1' },
        { name: 'b', source: './b', version: '1' },
        { name: 'c', source: { ...command, timeout: 30, mode: 'link' }, version: '2' },
      ),
      filename,
      errors: [{ messageId: 'ignored' }, { messageId: 'ignored' }],
    },
    // An empty string is a set `version`.
    {
      code: manifest({ name: 'p', source: command, version: '' }),
      filename,
      errors: [{ messageId: 'ignored' }],
    },
    // Two `version` keys. `JSON.parse` keeps the last.
    {
      code: `{"plugins": [{"source": ${JSON.stringify(command)}, "version": 1, "version": "2"}]}`,
      filename,
      errors: [{ messageId: 'ignored' }],
    },
    {
      code: `{"plugins": [{"source": "./p", "source": ${JSON.stringify(command)}, "version": "2"}]}`,
      filename,
      errors: [{ messageId: 'ignored' }],
    },
  ],
})
