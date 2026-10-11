// The rule reads each entry of `plugins` in `.claude-plugin/marketplace.json`. The files glob
// is in tests/configs.test.ts.
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('marketplace-archive-sha256')
const filename = '.claude-plugin/marketplace.json'
const manifest = (...plugins: unknown[]) => JSON.stringify({ name: 'acme', plugins })
const digest = '6bfa50e3d2e00c052b46abe51fff89346ac803e45771f76dcf6df1ab74cca5e1'
const archive = { source: 'archive', url: 'https://artifacts.example.com/formatter-2.0.0.zip' }

jsonTester.run('marketplace-archive-sha256 (valid)', rule, {
  valid: [
    { code: manifest({ name: 'p', source: { ...archive, sha256: digest } }), filename },
    // The key is there. A bad value is for `marketplace-source-schema`.
    { code: manifest({ name: 'p', source: { ...archive, sha256: 'abc' } }), filename },
    { code: manifest({ name: 'p', source: { ...archive, sha256: 3 } }), filename },
    // Another source type has no `sha256`.
    {
      code: manifest(
        { name: 'a', source: './plugins/a' },
        { name: 'b', source: { source: 'github', repo: 'o/r' } },
        { name: 'c', source: { source: 'url', url: 'https://x.test/r.git' } },
        { name: 'd', source: { source: 'npm', package: 'p' } },
        { name: 'e', source: { source: 'command', command: 'my-tool' } },
      ),
      filename,
    },
    // A value of the wrong type is for `marketplace-schema` or `marketplace-source-schema`.
    { code: manifest({ name: 'p', source: { source: 3 } }), filename },
    { code: manifest({ name: 'p', source: { url: archive.url } }), filename },
    { code: manifest({ name: 'p', source: ['archive'] }), filename },
    { code: manifest({ name: 'p', source: 'archive' }), filename },
    { code: manifest('p', null, 3, ['x']), filename },
    { code: JSON.stringify({ name: 'acme', plugins: { name: 'p' } }), filename },
    { code: '[]', filename },
    // Two `sha256` keys, and two `source` keys. The rule reads the last of each.
    {
      code: `{"plugins": [{"name": "p", "source": {"source": "archive", "sha256": "${digest}", "sha256": "x"}}]}`,
      filename,
    },
    {
      code: `{"plugins": [{"name": "p", "source": {"source": "archive"}, "source": "./p"}]}`,
      filename,
    },
  ],
  invalid: [],
})

jsonTester.run('marketplace-archive-sha256 (invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: manifest({ name: 'p', source: archive }),
      filename,
      errors: [{ messageId: 'unpinned', line: 1, column: 48, endColumn: 126 }],
    },
    // The entry that sets a `headersHelper` is one `claude plugin validate` warns on. The other
    // entry is not. Each reports once.
    {
      code: manifest(
        { name: 'a', strict: false, source: archive, headersHelper: '/opt/bin/mint' },
        { name: 'b', source: { ...archive, url: 'https://x.test/b.zip' } },
        { name: 'c', source: { ...archive, sha256: digest } },
      ),
      filename,
      errors: [{ messageId: 'unpinned' }, { messageId: 'unpinned' }],
    },
    // Two `source` keys. The rule reads the last.
    {
      code: '{"plugins": [{"name": "p", "source": "./p", "source": {"source": "archive"}}]}',
      filename,
      errors: [{ messageId: 'unpinned' }],
    },
  ],
})
