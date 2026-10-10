// The rule needs the option `minVersion`. With no option it makes no report. The files glob is
// in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('marketplace-min-version')
const filename = '.claude-plugin/marketplace.json'
const manifest = (extra: Record<string, unknown>, ...plugins: unknown[]) =>
  JSON.stringify({ name: 'acme', ...extra, plugins })
const archive = { source: 'archive', url: 'https://x.test/a.zip' }
const command = { source: 'command', command: 'my-tool' }
/** The error of a field that is newer than `minVersion`. */
const tooNew = (feature: string, since: string, minVersion: string) => ({
  messageId: 'tooNew' as const,
  data: { feature, since, minVersion },
})
// A marketplace with one field of each kind that needs a version.
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
    // A version equal to the version of a field is silent, for each field.
    ...[
      ['2.1.222', manifest({}, { name: 'a', source: './a', metadata: {} })],
      ['2.1.224', manifest({}, { name: 'a', source: archive })],
      ['2.1.229', manifest({}, { name: 'a', source: command })],
      ['2.1.238', manifest({}, { name: 'a', source: './a', headers: {}, headersHelper: 'x' })],
    ].map(([minVersion, code]) => ({ code: code as string, filename, options: [{ minVersion }] })),
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
      code: manifest({}, { name: 'a', source: { source: 'url', url: 'https://x.test/r.git' } }),
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
        { ...tooNew('"metadata.pluginRoot" field', '2.1.239', '2.1.0'), line: 1, column: 28 },
        { ...tooNew('entry field "metadata"', '2.1.222', '2.1.0'), line: 1, column: 92 },
        { ...tooNew('"archive" source', '2.1.224', '2.1.0'), line: 1, column: 138 },
        { ...tooNew('entry field "headers"', '2.1.238', '2.1.0'), line: 1, column: 193 },
        { ...tooNew('entry field "headersHelper"', '2.1.238', '2.1.0'), line: 1, column: 215 },
        { ...tooNew('"command" source', '2.1.229', '2.1.0'), line: 1, column: 272 },
      ],
    },
    // Each field below its own version, one version below.
    ...[
      [
        '2.1.237',
        manifest({}, { name: 'a', source: './a', headers: {} }),
        'entry field "headers"',
        '2.1.238',
      ],
      [
        '2.1.237',
        manifest({}, { name: 'a', source: './a', headersHelper: 'x' }),
        'entry field "headersHelper"',
        '2.1.238',
      ],
    ].map(([minVersion, code, feature, since]) => ({
      code: code as string,
      filename,
      options: [{ minVersion }],
      errors: [tooNew(feature as string, since as string, minVersion as string)],
    })),
    // A value of the wrong type is a fault for the schema rules. The rule still reports the key.
    {
      code: manifest({ metadata: { pluginRoot: 3 } }, { name: 'a', source: './a', headers: null }),
      filename,
      options: [{ minVersion: '2.1.0' }],
      errors: [
        {
          messageId: 'tooNew',
          data: { feature: '"metadata.pluginRoot" field', since: '2.1.239', minVersion: '2.1.0' },
        },
        {
          messageId: 'tooNew',
          data: { feature: 'entry field "headers"', since: '2.1.238', minVersion: '2.1.0' },
        },
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

describe('marketplace-min-version option schema', () => {
  const [schema] = (rule.meta as { schema: unknown }).schema as [
    { properties: { minVersion: { pattern: string } }; additionalProperties: boolean },
  ]
  const pattern = new RegExp(schema.properties.minVersion.pattern)

  it.each(['2.1.0', '2.1.239', '10.20.300'])('accepts %s', (version) => {
    expect(pattern.test(version)).toBe(true)
  })

  it.each(['2.1', 'v2.1.0', '2.1.0-beta', '2.1.0.1', '2.1.x', '', '2.1.0\n'])(
    'refuses %j',
    (version) => {
      expect(pattern.test(version)).toBe(false)
    },
  )

  it('refuses another option', () => {
    expect(schema.additionalProperties).toBe(false)
  })
})
