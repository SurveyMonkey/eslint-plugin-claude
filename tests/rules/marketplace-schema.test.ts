// The rule reads the top-level members, `owner`, `metadata` and the entries of
// `plugins` in `.claude-plugin/marketplace.json`. The files glob and the decoy
// files are in tests/configs.test.ts.
import schema from '../../src/rules/marketplace-schema.ts'
import { json5Tester, jsonTester } from '../rule-tester.test-support.ts'

const { rule } = schema
const filename = '.claude-plugin/marketplace.json'

const entry = { name: 'p', source: './p' }
const base = { name: 'acme', owner: { name: 'Acme' }, plugins: [entry] }
/** The valid base file with `patch` merged over the top level. */
const top = (patch: Record<string, unknown>) => JSON.stringify({ ...base, ...patch })
/** The valid base file with `patch` merged over the one entry. */
const withEntry = (patch: Record<string, unknown>) =>
  JSON.stringify({ ...base, plugins: [{ ...entry, ...patch }] })
/** The base file with the key `key` removed from the top level. */
const without = (key: string) =>
  JSON.stringify(Object.fromEntries(Object.entries(base).filter(([k]) => k !== key)))

const everyField = {
  name: 'acme',
  owner: { name: 'Acme', email: 'a@acme.test', url: 'https://acme.test' },
  plugins: [
    {
      name: 'p',
      source: { source: 'github', repo: 'o/r' },
      description: 'd',
      version: '1.0.0',
      category: 'c',
      tags: ['a', 'b'],
      strict: false,
      defaultEnabled: true,
      displayName: 'P',
      headers: { 'X-Key': 'v' },
      headersHelper: 'mint',
      metadata: { anything: [1] },
      experimental: { skills: [] },
      relevance: { topic: 't', signals: [] },
      hooks: { PostToolUse: [] },
      author: 5,
      dependencies: 'any',
    },
    { name: 'q', source: './q', hooks: './hooks.json' },
    { name: 'r', source: '.', hooks: ['./hooks.json'] },
  ],
  $schema: 'https://example.com/schema.json',
  description: 'd',
  version: '1.0.0',
  metadata: { description: 'd', version: '2', pluginRoot: './plugins', extra: 1 },
  forceRemoveDeletedPlugins: true,
  allowCrossMarketplaceDependenciesOn: ['other'],
  renames: { old: 'new', gone: null },
  unknown: 1,
}

/** A value of the wrong type, as `[key, value, expected]`. */
const TOP_WRONG: [string, unknown, string][] = [
  ['name', 5, 'a string'],
  ['name', null, 'a string'],
  ['name', ['acme'], 'a string'],
  ['owner', 'Acme', 'an object'],
  ['owner', [], 'an object'],
  ['owner', null, 'an object'],
  ['plugins', {}, 'an array'],
  ['plugins', 'p', 'an array'],
  ['$schema', 1, 'a string'],
  ['description', true, 'a string'],
  ['version', 1, 'a string'],
  ['version', null, 'a string'],
  ['forceRemoveDeletedPlugins', 'true', 'a boolean'],
  ['forceRemoveDeletedPlugins', 1, 'a boolean'],
  ['allowCrossMarketplaceDependenciesOn', 'other', 'an array of strings'],
  ['allowCrossMarketplaceDependenciesOn', {}, 'an array of strings'],
  ['renames', ['a'], 'an object'],
  ['renames', 'x', 'an object'],
]

/** A value of the wrong type, as `[key, value, expected]`. */
const METADATA_WRONG: [string, unknown][] = [
  ['description', 1],
  ['version', 2],
  ['pluginRoot', ['./plugins']],
]

/** A value of the wrong type, as `[key, value, expected]`. */
const ENTRY_WRONG: [string, unknown, string][] = [
  ['name', 5, 'a string'],
  ['source', 5, 'a string or an object'],
  ['source', null, 'a string or an object'],
  ['source', ['./p'], 'a string or an object'],
  ['source', true, 'a string or an object'],
  ['description', 5, 'a string'],
  ['version', 1.5, 'a string'],
  ['version', null, 'a string'],
  ['category', 5, 'a string'],
  ['tags', 'a', 'an array of strings'],
  ['tags', {}, 'an array of strings'],
  ['strict', 'false', 'a boolean'],
  ['defaultEnabled', 0, 'a boolean'],
  ['displayName', 5, 'a string'],
  ['headers', [], 'an object'],
  ['headers', 'X-Key: v', 'an object'],
  ['headersHelper', 5, 'a string'],
  ['headersHelper', null, 'a string'],
  ['headersHelper', ['mint'], 'a string'],
  ['hooks', 3, 'an object'],
  ['hooks', null, 'an object'],
  ['hooks', true, 'an object'],
]

jsonTester.run('marketplace-schema (valid)', rule, {
  valid: [
    { code: JSON.stringify(base), filename },
    { code: JSON.stringify(everyField), filename },
    { code: top({ plugins: [] }), filename },
    // `owner` `email` and `url` have no type in the docs.
    { code: top({ owner: { name: 'A', email: 5, url: null } }), filename },
    // `metadata` has no type of its own at the top level in the docs, and no empty `name` check for an entry.
    { code: top({ metadata: 'x' }), filename },
    { code: top({ metadata: null }), filename },
    { code: top({ metadata: [] }), filename },
    { code: top({ renames: {} }), filename },
    { code: top({ allowCrossMarketplaceDependenciesOn: [] }), filename },
    { code: withEntry({ name: '' }), filename },
    // The characters that the docs allow in a name, and a `..` in an entry name.
    { code: top({ name: 'A1.b_c-d' }), filename },
    { code: top({ name: '9lives' }), filename },
    { code: top({ name: 'café' }), filename },
    { code: withEntry({ name: 'x.y_z-1' }), filename },
    { code: withEntry({ name: 'a..b' }), filename },
    // Claude Code ignores an entry `metadata`, `experimental` or `relevance` that is not an object.
    // `claude plugin validate` warns, so the rule gives no report at `error`.
    { code: withEntry({ metadata: 'free' }), filename },
    { code: withEntry({ experimental: [] }), filename },
    { code: withEntry({ relevance: null }), filename },
    { code: withEntry({ tags: [] }), filename },
    // An entry `hooks` that is a string or an array is for `marketplace-entry-hooks-inline`.
    { code: withEntry({ hooks: '' }), filename },
    { code: withEntry({ hooks: [] }), filename },
    // An object `source` is for `marketplace-source-schema`, and a string for the format rule.
    { code: withEntry({ source: {} }), filename },
    { code: withEntry({ source: { source: 5 } }), filename },
    { code: withEntry({ source: '../x' }), filename },
    // Two keys. The rule reads the last, as `JSON.parse` does.
    {
      code: '{"name": 5, "name": "acme", "owner": {"name": "A"}, "plugins": []}',
      filename,
    },
    {
      code: '{"name": "a", "owner": {"name": 5, "name": "A"}, "plugins": [{"name": "p", "source": 5, "source": "./p"}]}',
      filename,
    },
    {
      code: '{"name": "a", "owner": {"name": "A"}, "plugins": [], "metadata": {"version": 5, "version": "1"}}',
      filename,
    },
  ],
  invalid: [],
})

jsonTester.run('marketplace-schema (invalid)', rule, {
  valid: [],
  invalid: [
    // The file.
    {
      code: '[]',
      filename,
      errors: [{ messageId: 'notObject', line: 1, column: 1, endColumn: 3 }],
    },
    { code: '"x"', filename, errors: [{ messageId: 'notObject' }] },
    { code: 'null', filename, errors: [{ messageId: 'notObject' }] },
    // A required key that is missing, on the object that lacks it.
    {
      code: without('name'),
      filename,
      errors: [
        {
          messageId: 'missing',
          data: { where: 'marketplace file', key: 'name' },
          line: 1,
          column: 1,
          endColumn: 66,
        },
      ],
    },
    {
      code: without('owner'),
      filename,
      errors: [{ messageId: 'missing', data: { where: 'marketplace file', key: 'owner' } }],
    },
    {
      code: without('plugins'),
      filename,
      errors: [{ messageId: 'missing', data: { where: 'marketplace file', key: 'plugins' } }],
    },
    {
      code: '{}',
      filename,
      errors: [
        { messageId: 'missing', data: { where: 'marketplace file', key: 'name' } },
        { messageId: 'missing', data: { where: 'marketplace file', key: 'owner' } },
        { messageId: 'missing', data: { where: 'marketplace file', key: 'plugins' } },
      ],
    },
    {
      code: top({ owner: {} }),
      filename,
      errors: [{ messageId: 'missing', data: { where: '"owner" object', key: 'name' } }],
    },
    {
      code: withEntry({ name: undefined }),
      filename,
      errors: [{ messageId: 'missing', data: { where: 'entry plugins[0]', key: 'name' } }],
    },
    {
      code: withEntry({ source: undefined }),
      filename,
      errors: [{ messageId: 'missing', data: { where: 'entry plugins[0]', key: 'source' } }],
    },
    {
      code: top({ plugins: [entry, { description: 'd' }] }),
      filename,
      errors: [
        { messageId: 'missing', data: { where: 'entry plugins[1]', key: 'name' } },
        { messageId: 'missing', data: { where: 'entry plugins[1]', key: 'source' } },
      ],
    },
    // A name with a character that the docs do not allow, or a first character that is not a letter or a digit.
    ...[
      'my marketplace',
      'a/b',
      'a\\b',
      '-a',
      '.a',
      '_a',
      'a+b',
      'a@b',
      'a\u001bb',
      'a\nb',
      '.',
    ].map((name) => ({
      code: top({ name }),
      filename,
      errors: [{ messageId: 'nameCharacters' as const, data: { path: 'name' } }],
    })),
    // A marketplace name has no `..`. The report is one for each name.
    {
      code: top({ name: 'a..b' }),
      filename,
      errors: [{ messageId: 'nameDots', data: { path: 'name' } }],
    },
    {
      code: top({ name: '-a..b' }),
      filename,
      errors: [{ messageId: 'nameCharacters', data: { path: 'name' } }],
    },
    {
      code: withEntry({ name: 'my plugin' }),
      filename,
      errors: [{ messageId: 'nameCharacters', data: { path: 'plugins[0].name' }, line: 1 }],
    },
    {
      code: withEntry({ name: '.p' }),
      filename,
      errors: [{ messageId: 'nameCharacters', data: { path: 'plugins[0].name' } }],
    },
    // An empty `name`, as `claude plugin validate` reports for the marketplace and the owner.
    { code: top({ name: '' }), filename, errors: [{ messageId: 'empty', data: { path: 'name' } }] },
    {
      code: top({ owner: { name: '' } }),
      filename,
      errors: [{ messageId: 'empty', data: { path: 'owner.name' } }],
    },
    // A value of the wrong type for each field of the top level.
    ...TOP_WRONG.map(([key, value, expected]) => ({
      code: top({ [key]: value }),
      filename,
      errors: [{ messageId: 'wrongType', data: { path: key, expected } }],
    })),
    {
      code: top({ allowCrossMarketplaceDependenciesOn: ['a', 5, null, 'b'] }),
      filename,
      errors: [
        { messageId: 'notStringElement', data: { path: 'allowCrossMarketplaceDependenciesOn' } },
        { messageId: 'notStringElement', data: { path: 'allowCrossMarketplaceDependenciesOn' } },
      ],
    },
    {
      code: top({ renames: { a: 'b', c: 5, d: null, e: {}, f: ['g'] } }),
      filename,
      errors: [
        { messageId: 'renamesValue' },
        { messageId: 'renamesValue' },
        { messageId: 'renamesValue' },
      ],
    },
    // The `metadata` fields.
    ...METADATA_WRONG.map(([key, value]) => ({
      code: top({ metadata: { [key]: value } }),
      filename,
      errors: [{ messageId: 'wrongType', data: { path: `metadata.${key}`, expected: 'a string' } }],
    })),
    // A value of the wrong type for each field of an entry.
    ...ENTRY_WRONG.map(([key, value, expected]) => ({
      code: withEntry({ [key]: value }),
      filename,
      errors: [{ messageId: 'wrongType', data: { path: `plugins[0].${key}`, expected } }],
    })),
    {
      code: withEntry({ tags: ['a', 1, {}] }),
      filename,
      errors: [
        { messageId: 'notStringElement', data: { path: 'plugins[0].tags' } },
        { messageId: 'notStringElement', data: { path: 'plugins[0].tags' } },
      ],
    },
    // An item of `plugins` that is not an object.
    {
      code: top({ plugins: [entry, 'p', null, 3, [entry]] }),
      filename,
      errors: [
        { messageId: 'entryNotObject', line: 1, column: 79, endColumn: 82 },
        { messageId: 'entryNotObject' },
        { messageId: 'entryNotObject' },
        { messageId: 'entryNotObject' },
      ],
    },
    // The path names the index of the entry.
    {
      code: top({ plugins: [entry, { ...entry, tags: 'a' }] }),
      filename,
      errors: [
        {
          messageId: 'wrongType',
          data: { path: 'plugins[1].tags', expected: 'an array of strings' },
        },
      ],
    },
    // Two keys. The rule reads the last, as `JSON.parse` does.
    {
      code: '{"name": "a", "name": 5, "owner": {"name": "A"}, "plugins": []}',
      filename,
      errors: [{ messageId: 'wrongType', data: { path: 'name', expected: 'a string' } }],
    },
    {
      code: '{"name": "a", "owner": {"name": "A", "name": 5}, "plugins": []}',
      filename,
      errors: [{ messageId: 'wrongType', data: { path: 'owner.name', expected: 'a string' } }],
    },
    {
      code: '{"name": "a", "owner": {"name": "A"}, "plugins": [], "metadata": {"version": "1", "version": 5}}',
      filename,
      errors: [
        { messageId: 'wrongType', data: { path: 'metadata.version', expected: 'a string' } },
      ],
    },
    {
      code: '{"name": "a", "owner": {"name": "A"}, "plugins": [{"name": "p", "source": "./p", "source": 5}]}',
      filename,
      errors: [
        {
          messageId: 'wrongType',
          data: { path: 'plugins[0].source', expected: 'a string or an object' },
        },
      ],
    },
    // Each fault reports once.
    {
      code: JSON.stringify({ name: 5, owner: 'x', plugins: [{ name: 6, source: 7 }] }),
      filename,
      errors: [
        { messageId: 'wrongType', data: { path: 'name', expected: 'a string' } },
        { messageId: 'wrongType', data: { path: 'owner', expected: 'an object' } },
        { messageId: 'wrongType', data: { path: 'plugins[0].name', expected: 'a string' } },
        {
          messageId: 'wrongType',
          data: { path: 'plugins[0].source', expected: 'a string or an object' },
        },
      ],
    },
  ],
})

// JSON5 allows a bare key, a single-quoted string, and `Infinity` and `NaN`. The rule reads
// each key and value in the same way.
json5Tester.run('marketplace-schema (JSON5 valid)', rule, {
  valid: [
    { code: "{ name: 'a', owner: { name: 'A' }, plugins: [{ name: 'p', source: './p' }] }" },
    { code: "{ 'name': 'a', owner: { name: 'A' }, plugins: [], metadata: { pluginRoot: './p' } }" },
  ],
  invalid: [],
})

json5Tester.run('marketplace-schema (JSON5 invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: "{ name: 'a', owner: { name: 'A' } }",
      errors: [{ messageId: 'missing', data: { where: 'marketplace file', key: 'plugins' } }],
    },
    {
      code: "{ name: 'a', owner: { name: 'A' }, plugins: [{ name: 'p', source: Infinity }] }",
      errors: [
        {
          messageId: 'wrongType',
          data: { path: 'plugins[0].source', expected: 'a string or an object' },
        },
      ],
    },
    {
      code: "{ name: NaN, owner: { name: 'A' }, plugins: [] }",
      errors: [{ messageId: 'wrongType', data: { path: 'name', expected: 'a string' } }],
    },
    {
      code: "{ name: 'a', owner: { name: 'A' }, plugins: [], renames: { a: 1 } }",
      errors: [{ messageId: 'renamesValue' }],
    },
  ],
})
