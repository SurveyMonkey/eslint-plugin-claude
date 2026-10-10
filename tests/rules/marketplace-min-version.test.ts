// The rule needs the option `minVersion`. With no option it makes no report. The files glob is
// in tests/configs.test.ts.
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('marketplace-min-version')
const filename = '.claude-plugin/marketplace.json'
const manifest = (extra: Record<string, unknown>, ...plugins: unknown[]) =>
  JSON.stringify({ name: 'acme', ...extra, plugins })
const archive = { source: 'archive', url: 'https://x.test/a.zip' }
const command = { source: 'command', command: 'my-tool' }
// An entry or a marketplace with one field of each kind that needs a version.
/** The error of a field that is newer than \`minVersion\`. */
const tooNew = (feature: string, since: string, minVersion: string) => ({
  messageId: 'tooNew' as const,
  data: { feature, since, minVersion },
})
const everything = manifest(
  { metadata: { pluginRoot: './plugins' } },
  { name: 'a', source: './a', metadata: {} },
  { name: 'b', source: archive, strict: false, headers: { 'X-A': 'b' }, headersHelper: '/opt/m' },
  { name: 'c', source: command },
)

jsonTester.run('marketplace-min-version (valid)', rule, {
  valid: [
    // With no option, the rule is off.
    { code: everything, filename },
    { code: everything, filename, options: [{}] },
    // The configured version is the version of the field, or newer.
    { code: everything, filename, options: [{ minVersion: '2.1.239' }] },
    { code: everything, filename, options: [{ minVersion: '2.1.300' }] },
    { code: everything, filename, options: [{ minVersion: '2.2.0' }] },
    { code: everything, filename, options: [{ minVersion: '3.0.0' }] },
    { code: everything, filename, options: [{ minVersion: '10.0.0' }] },
    // A marketplace with no field that needs a version.
    {
      code: manifest(
        { metadata: { description: 'd', version: '1' } },
        { name: 'a', source: './a' },
        { name: 'b', source: { source: 'github', repo: 'o/r' } },
        { name: 'c', source: { source: 'npm', package: 'p' } },
      ),
      filename,
      options: [{ minVersion: '1.0.0' }],
    },
    // The rule reads keys, not text. A source type in another place is not a source type.
    {
      code: manifest({}, { name: 'archive', source: './command', description: 'headers' }),
      filename,
      options: [{ minVersion: '1.0.0' }],
    },
    // A value of the wrong type is for the schema rules.
    {
      code: manifest({ metadata: 3 }, 'p', null, { source: 3 }, { source: ['archive'] }),
      filename,
      options: [{ minVersion: '1.0.0' }],
    },
    {
      code: JSON.stringify({ plugins: { metadata: {} } }),
      filename,
      options: [{ minVersion: '1.0.0' }],
    },
    { code: '[]', filename, options: [{ minVersion: '1.0.0' }] },
    // Two keys of one name. The rule reads the last, as `JSON.parse` does.
    {
      code: '{"plugins": [{"name": "p", "source": "./p", "source": {"source": "github"}}]}',
      filename,
      options: [{ minVersion: '1.0.0' }],
    },
  ],
  invalid: [],
})

jsonTester.run('marketplace-min-version (invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: manifest({}, { name: 'a', source: './a', metadata: {} }),
      filename,
      options: [{ minVersion: '2.1.99' }],
      errors: [
        {
          messageId: 'tooNew',
          data: { feature: 'entry field "metadata"', since: '2.1.222', minVersion: '2.1.99' },
          line: 1,
          column: 54,
        },
      ],
    },
    // Each field and each source type, at a version just below its own.
    {
      code: manifest({ metadata: { pluginRoot: './plugins' } }, { name: 'a', source: 'a' }),
      filename,
      options: [{ minVersion: '2.1.238' }],
      errors: [
        {
          messageId: 'tooNew',
          data: { feature: '"metadata.pluginRoot" field', since: '2.1.239', minVersion: '2.1.238' },
        },
      ],
    },
    {
      code: manifest({}, { name: 'a', source: archive }),
      filename,
      options: [{ minVersion: '2.1.223' }],
      errors: [
        {
          messageId: 'tooNew',
          data: { feature: '"archive" source', since: '2.1.224', minVersion: '2.1.223' },
        },
      ],
    },
    {
      code: manifest({}, { name: 'a', source: command }),
      filename,
      options: [{ minVersion: '2.1.228' }],
      errors: [
        {
          messageId: 'tooNew',
          data: { feature: '"command" source', since: '2.1.229', minVersion: '2.1.228' },
        },
      ],
    },
    {
      code: manifest({}, { name: 'a', source: archive, headers: {}, headersHelper: 'x' }),
      filename,
      options: [{ minVersion: '2.1.223' }],
      errors: [
        tooNew('"archive" source', '2.1.224', '2.1.223'),
        tooNew('entry field "headers"', '2.1.238', '2.1.223'),
        tooNew('entry field "headersHelper"', '2.1.238', '2.1.223'),
      ],
    },
    // The compare is numeric on each part: a major, a minor and a patch part below the field.
    {
      code: manifest({}, { name: 'a', source: './a', metadata: {} }),
      filename,
      options: [{ minVersion: '1.9.999' }],
      errors: [{ messageId: 'tooNew' }],
    },
    {
      code: manifest({}, { name: 'a', source: './a', metadata: {} }),
      filename,
      options: [{ minVersion: '2.0.999' }],
      errors: [{ messageId: 'tooNew' }],
    },
    {
      code: manifest({}, { name: 'a', source: './a', metadata: {} }),
      filename,
      options: [{ minVersion: '2.1.221' }],
      errors: [{ messageId: 'tooNew' }],
    },
    // Every field of the table, in file order.
    {
      code: everything,
      filename,
      options: [{ minVersion: '2.1.0' }],
      errors: [
        tooNew('"metadata.pluginRoot" field', '2.1.239', '2.1.0'),
        tooNew('entry field "metadata"', '2.1.222', '2.1.0'),
        tooNew('"archive" source', '2.1.224', '2.1.0'),
        tooNew('entry field "headers"', '2.1.238', '2.1.0'),
        tooNew('entry field "headersHelper"', '2.1.238', '2.1.0'),
        tooNew('"command" source', '2.1.229', '2.1.0'),
      ],
    },
    // Two keys of one name. The rule reads the last, as `JSON.parse` does.
    {
      code: '{"plugins": [{"name": "p", "source": "./p", "source": {"source": "archive"}, "metadata": 1, "metadata": {}}]}',
      filename,
      options: [{ minVersion: '2.1.0' }],
      errors: [{ messageId: 'tooNew' }, { messageId: 'tooNew' }],
    },
  ],
})
