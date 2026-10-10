// The rule reads the path of the file and the `plugins` array of its text. The `files` glob
// and the decoy files are in tests/configs.test.ts.
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('marketplace-location')
const manifest = JSON.stringify({ name: 'acme', owner: { name: 'a' }, plugins: [] })

jsonTester.run('marketplace-location (valid)', rule, {
  valid: [
    { code: manifest, filename: '.claude-plugin/marketplace.json' },
    { code: manifest, filename: 'packages/m/.claude-plugin/marketplace.json' },
    // A file that does not look like a marketplace is not known to be one.
    { code: '{"name": "acme"}', filename: 'docs/marketplace.json' },
    { code: '{"plugins": {"name": "p"}}', filename: 'docs/marketplace.json' },
    { code: '{"plugins": null}', filename: 'marketplace.json' },
    { code: '[]', filename: 'marketplace.json' },
    // A directory named like the folder, but not the folder.
    { code: '{"name": "acme"}', filename: '.claude-plugin/sub/marketplace.json' },
  ],
  invalid: [],
})

jsonTester.run('marketplace-location (invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: manifest,
      filename: 'marketplace.json',
      errors: [{ messageId: 'misplaced', line: 1, column: 1 }],
    },
    {
      code: manifest,
      filename: 'docs/marketplace.json',
      errors: [{ messageId: 'misplaced' }],
    },
    // A folder with another name.
    {
      code: '{"name": "acme", "plugins": [{"name": "p", "source": "./p"}]}',
      filename: '.claude/marketplace.json',
      errors: [{ messageId: 'misplaced' }],
    },
    // Two `plugins` keys. The rule reads the last, as `JSON.parse` does.
    {
      code: '{"plugins": null, "plugins": []}',
      filename: 'marketplace.json',
      errors: [{ messageId: 'misplaced' }],
    },
  ],
})
