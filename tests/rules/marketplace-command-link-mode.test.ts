// The rule reads each entry of `plugins` in `.claude-plugin/marketplace.json`. The files glob
// is in tests/configs.test.ts.
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('marketplace-command-link-mode')
const filename = '.claude-plugin/marketplace.json'
const manifest = (...plugins: unknown[]) => JSON.stringify({ name: 'acme', plugins })
const command = { source: 'command', command: 'my-tool claude-plugin-path' }

jsonTester.run('marketplace-command-link-mode (valid)', rule, {
  valid: [
    // Copy mode is the default, and it works on Windows.
    {
      code: manifest(
        { name: 'a', source: command },
        { name: 'b', source: { ...command, mode: 'copy' } },
      ),
      filename,
    },
    // Another source type has no `mode`.
    {
      code: manifest(
        { name: 'a', source: { source: 'github', repo: 'o/r', mode: 'link' } },
        { name: 'b', source: { source: 'archive', url: 'https://x.test/a.zip', mode: 'link' } },
        { name: 'c', source: './plugins/a', mode: 'link' },
      ),
      filename,
    },
    // `mode` in the entry, and not in the source.
    { code: manifest({ name: 'p', source: command, mode: 'link' }), filename },
    // A value of the wrong type or another word is for `marketplace-source-schema`.
    { code: manifest({ name: 'p', source: { ...command, mode: 'Link' } }), filename },
    { code: manifest({ name: 'p', source: { ...command, mode: true } }), filename },
    { code: manifest({ name: 'p', source: { ...command, mode: ['link'] } }), filename },
    { code: manifest({ name: 'p', source: { source: 3, mode: 'link' } }), filename },
    { code: manifest({ name: 'p', source: ['command'] }), filename },
    { code: manifest('p', null, 3, ['x']), filename },
    { code: JSON.stringify({ name: 'acme', plugins: { name: 'p' } }), filename },
    { code: '[]', filename },
    // Two `mode` keys, and two `source` keys. The rule reads the last of each.
    {
      code: `{"plugins": [{"name": "p", "source": {"source": "command", "mode": "link", "mode": "copy"}}]}`,
      filename,
    },
    {
      code: `{"plugins": [{"name": "p", "source": ${JSON.stringify({ ...command, mode: 'link' })}, "source": "./p"}]}`,
      filename,
    },
  ],
  invalid: [],
})

jsonTester.run('marketplace-command-link-mode (invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: manifest({ name: 'p', source: { ...command, mode: 'link' } }),
      filename,
      errors: [{ messageId: 'link', line: 1, column: 114, endColumn: 120 }],
    },
    // Each `command` source with `link` reports once.
    {
      code: manifest(
        { name: 'a', source: { ...command, mode: 'link', timeout: 30 } },
        { name: 'b', source: { ...command, mode: 'copy' } },
        { name: 'c', source: { ...command, mode: 'link' } },
      ),
      filename,
      errors: [{ messageId: 'link' }, { messageId: 'link' }],
    },
    // Two `mode` keys, and two `source` keys. The rule reads the last of each.
    {
      code: '{"plugins": [{"name": "p", "source": {"source": "command", "mode": "copy", "mode": "link"}}]}',
      filename,
      errors: [{ messageId: 'link' }],
    },
    {
      code: `{"plugins": [{"name": "p", "source": "./p", "source": ${JSON.stringify({ ...command, mode: 'link' })}}]}`,
      filename,
      errors: [{ messageId: 'link' }],
    },
  ],
})
