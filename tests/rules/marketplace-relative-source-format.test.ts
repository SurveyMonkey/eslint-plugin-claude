// The rule reads the string `source` of each entry in `plugins`, and
// `metadata.pluginRoot`, in `.claude-plugin/marketplace.json`. The files glob
// and the decoy files are in tests/configs.test.ts.
import relativeSource from '../../src/rules/marketplace-relative-source-format.ts'
import { json5Tester, jsonTester } from '../rule-tester.test-support.ts'

const { rule } = relativeSource
const filename = '.claude-plugin/marketplace.json'
const manifest = (plugins: unknown[], metadata?: unknown) =>
  JSON.stringify({ name: 'acme', metadata, plugins })
const withSource = (source: unknown, metadata?: unknown) =>
  manifest([{ name: 'p', source }], metadata)
const withRoot = (pluginRoot: unknown) => manifest([], { pluginRoot })

jsonTester.run('marketplace-relative-source-format (valid)', rule, {
  valid: [
    { code: withSource('./plugins/formatter'), filename },
    { code: withSource('./p'), filename },
    { code: withSource('./'), filename },
    { code: withSource('.'), filename },
    // `//` that is not at the start is not a network path.
    { code: withSource('./a//b'), filename },
    // A bare name with a `pluginRoot`.
    { code: withSource('formatter', { pluginRoot: './plugins' }), filename },
    { code: withSource('a:b', { pluginRoot: './plugins' }), filename },
    // A `pluginRoot` has no effect on a source that starts with `./`.
    { code: withSource('./formatter', { pluginRoot: './plugins' }), filename },
    // A relative `pluginRoot` with or without `./`, and the root itself.
    { code: withRoot('./plugins'), filename },
    { code: withRoot('plugins'), filename },
    { code: withRoot('.'), filename },
    { code: withRoot(''), filename },
    // An object source is for `marketplace-source-schema`.
    { code: withSource({ source: 'github', repo: '../x' }), filename },
    // A value of the wrong type is for the schema rule.
    { code: withSource(5), filename },
    { code: withSource(null), filename },
    { code: withSource(['../x']), filename },
    { code: withRoot(5), filename },
    { code: withRoot(null), filename },
    { code: withSource('./p', null), filename },
    { code: manifest(['/abs', null, 3]), filename },
    { code: JSON.stringify({ name: 'acme', plugins: '/abs' }), filename },
    { code: JSON.stringify({ name: 'acme', metadata: ['../x'] }), filename },
    { code: '[]', filename },
    // Two `source` keys. The rule reads the last, as `JSON.parse` does.
    { code: '{"plugins": [{"source": "/abs", "source": "./p"}]}', filename },
    // Two `pluginRoot` keys. The rule reads the last.
    { code: '{"metadata": {"pluginRoot": "/abs", "pluginRoot": "./r"}}', filename },
    // Two `metadata` keys. The rule reads the last, so `x` is a bare name under `./r`.
    {
      code: '{"metadata": {}, "metadata": {"pluginRoot": "./r"}, "plugins": [{"source": "x"}]}',
      filename,
    },
  ],
  invalid: [],
})

jsonTester.run('marketplace-relative-source-format (invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: withSource('plugins/formatter'),
      filename,
      errors: [
        {
          messageId: 'noPrefix',
          data: { path: 'plugins/formatter' },
          line: 1,
          column: 48,
          endColumn: 67,
        },
      ],
    },
    { code: withSource(''), filename, errors: [{ messageId: 'noPrefix', data: { path: '' } }] },
    // A bare name without a `pluginRoot`, and with a `pluginRoot` that is not a string.
    { code: withSource('formatter'), filename, errors: [{ messageId: 'noPrefix' }] },
    // A drive letter needs a slash to be absolute. Else it is a name with no prefix.
    { code: withSource('C:p'), filename, errors: [{ messageId: 'noPrefix' }] },
    { code: withSource('formatter', 'x'), filename, errors: [{ messageId: 'noPrefix' }] },
    {
      code: withSource('formatter', { pluginRoot: 5 }),
      filename,
      errors: [{ messageId: 'noPrefix' }],
    },
    {
      code: withSource('formatter', { pluginRoot: '' }),
      filename,
      errors: [{ messageId: 'noPrefix' }],
    },
    // A source with a `/` is not a bare name, even with a `pluginRoot`.
    {
      code: withSource('team-a/formatter', { pluginRoot: './plugins' }),
      filename,
      errors: [{ messageId: 'noPrefix' }],
    },
    // A backslash is not part of a bare name.
    {
      code: withSource('a\\b', { pluginRoot: './plugins' }),
      filename,
      errors: [{ messageId: 'noPrefix' }],
    },
    {
      code: withSource('../x'),
      filename,
      errors: [{ messageId: 'parent', data: { field: '"source"', path: '../x' } }],
    },
    { code: withSource('./a/../b'), filename, errors: [{ messageId: 'parent' }] },
    { code: withSource('./a..b'), filename, errors: [{ messageId: 'parent' }] },
    { code: withSource('..'), filename, errors: [{ messageId: 'parent' }] },
    { code: withSource('/usr/share/p'), filename, errors: [{ messageId: 'absolute' }] },
    { code: withSource('\\p'), filename, errors: [{ messageId: 'absolute' }] },
    { code: withSource('C:\\p'), filename, errors: [{ messageId: 'absolute' }] },
    { code: withSource('c:/p'), filename, errors: [{ messageId: 'absolute' }] },
    { code: withSource('//host/share/p'), filename, errors: [{ messageId: 'network' }] },
    { code: withSource('\\\\host\\share\\p'), filename, errors: [{ messageId: 'network' }] },
    { code: withSource('/\\host'), filename, errors: [{ messageId: 'network' }] },
    // One report for each value, from the first fault in the order network, absolute, parent.
    { code: withSource('//h/../x'), filename, errors: [{ messageId: 'network' }] },
    { code: withSource('/a/../x'), filename, errors: [{ messageId: 'absolute' }] },
    // `pluginRoot`.
    {
      code: withRoot('/abs'),
      filename,
      errors: [{ messageId: 'absolute', data: { field: '"metadata.pluginRoot"', path: '/abs' } }],
    },
    {
      code: withRoot('../plugins'),
      filename,
      errors: [
        { messageId: 'parent', data: { field: '"metadata.pluginRoot"', path: '../plugins' } },
      ],
    },
    { code: withRoot('//host/p'), filename, errors: [{ messageId: 'network' }] },
    // Each entry, and the `pluginRoot`, report on their own.
    {
      code: manifest([{ source: './a' }, { source: 'b/c' }, { source: '../c' }], {
        pluginRoot: '/r',
      }),
      filename,
      errors: [
        { messageId: 'absolute', data: { field: '"metadata.pluginRoot"', path: '/r' } },
        { messageId: 'noPrefix', data: { path: 'b/c' } },
        { messageId: 'parent', data: { field: '"source"', path: '../c' } },
      ],
    },
    // Two `source` keys. `JSON.parse` keeps the last.
    {
      code: '{"plugins": [{"source": "./p", "source": "/abs"}]}',
      filename,
      errors: [{ messageId: 'absolute' }],
    },
    // Two `metadata` and two `pluginRoot` keys. `JSON.parse` keeps the last.
    {
      code: '{"metadata": {}, "metadata": {"pluginRoot": "./r", "pluginRoot": "/abs"}}',
      filename,
      errors: [{ messageId: 'absolute' }],
    },
  ],
})

// JSON5 allows a bare key. The rule reads it the same way.
json5Tester.run('marketplace-relative-source-format (JSON5 valid)', rule, {
  valid: [
    { code: "{ metadata: { pluginRoot: './r' }, plugins: [{ source: 'x' }] }" },
    { code: "{ plugins: [{ source: './x' }] }" },
  ],
  invalid: [],
})

json5Tester.run('marketplace-relative-source-format (JSON5 invalid)', rule, {
  valid: [],
  invalid: [
    { code: "{ plugins: [{ source: '../x' }] }", errors: [{ messageId: 'parent' }] },
    {
      code: "{ metadata: { pluginRoot: '/abs' }, plugins: [{ source: 'x' }] }",
      errors: [{ messageId: 'absolute' }],
    },
    {
      code: "{ metadata: { pluginRoot: './r' }, plugins: [{ source: 'a/b' }] }",
      errors: [{ messageId: 'noPrefix' }],
    },
  ],
})
