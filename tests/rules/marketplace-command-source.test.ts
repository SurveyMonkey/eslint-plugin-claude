// The rule reads each entry of `plugins` in `.claude-plugin/marketplace.json`. The files glob
// is in tests/configs.test.ts.
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('marketplace-command-source')
const filename = '.claude-plugin/marketplace.json'
const manifest = (...plugins: unknown[]) => JSON.stringify({ name: 'acme', plugins })
const command = { source: 'command', command: 'my-tool claude-plugin-path' }

jsonTester.run('marketplace-command-source (valid)', rule, {
  valid: [
    {
      code: manifest(
        { name: 'a', source: './plugins/a' },
        { name: 'b', source: { source: 'github', repo: 'o/r' } },
        { name: 'c', source: { source: 'npm', package: 'p' } },
        { name: 'd', source: { source: 'archive', url: 'https://x.test/a.zip' } },
      ),
      filename,
    },
    // The word "command" in another place is not a `command` source.
    { code: manifest({ name: 'p', source: './p', command: 'x', commands: './c' }), filename },
    {
      code: manifest({ name: 'p', source: { source: 'url', url: 'https://x.test/r.git' } }),
      filename,
    },
    // A value of the wrong type is for `marketplace-schema` or `marketplace-source-schema`.
    { code: manifest({ name: 'p', source: { source: 3, command: 'x' } }), filename },
    { code: manifest({ name: 'p', source: { command: 'x' } }), filename },
    { code: manifest({ name: 'p', source: ['command'] }), filename },
    { code: manifest({ name: 'p', source: 'command' }), filename },
    { code: manifest('p', null, 3, ['x']), filename },
    { code: JSON.stringify({ name: 'acme', plugins: { name: 'p' } }), filename },
    { code: '[]', filename },
    // Two `source` keys. The rule reads the last, as `JSON.parse` does.
    {
      code: `{"plugins": [{"name": "p", "source": ${JSON.stringify(command)}, "source": "./p"}]}`,
      filename,
    },
  ],
  invalid: [],
})

jsonTester.run('marketplace-command-source (invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: manifest({ name: 'p', source: command }),
      filename,
      errors: [{ messageId: 'review', line: 1, column: 58, endColumn: 67 }],
    },
    // Each `command` source reports once, whatever its other fields.
    {
      code: manifest(
        { name: 'a', source: command },
        { name: 'b', source: './b' },
        { name: 'c', source: { ...command, timeout: 30, mode: 'link' }, version: '1' },
      ),
      filename,
      errors: [{ messageId: 'review' }, { messageId: 'review' }],
    },
    // Two `source` keys. `JSON.parse` keeps the last.
    {
      code: `{"plugins": [{"name": "p", "source": "./p", "source": ${JSON.stringify(command)}}]}`,
      filename,
      errors: [{ messageId: 'review' }],
    },
  ],
})
