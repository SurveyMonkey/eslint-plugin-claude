// The rule reads `extraKnownMarketplaces` in `.claude/settings.json` and
// `.claude/settings.local.json`. The files glob and the decoy files are in
// tests/configs.test.ts.
import { json5Tester, jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-extra-known-marketplaces-schema')

const filename = '.claude/settings.json'
const local = '.claude/settings.local.json'
const types = 'github, git, url, file, directory, settings'
const marketplaces = (value: unknown) => JSON.stringify({ extraKnownMarketplaces: value })
/** A marketplace `acme` with the given `source`. */
const withSource = (source: unknown) => marketplaces({ acme: { source } })
const github = { source: 'github', repo: 'acme-corp/claude-plugins' }
const inline = (fields: Record<string, unknown>) => ({
  source: 'settings',
  name: 'acme',
  plugins: [],
  ...fields,
})
/** A `settings` source with one item in `plugins`. */
const withItem = (item: unknown) => withSource(inline({ plugins: [item] }))
const goodItem = { name: 'formatter', source: { source: 'github', repo: 'acme-corp/formatter' } }

jsonTester.run('settings-extra-known-marketplaces-schema (valid)', rule, {
  valid: [
    // The examples of the settings reference.
    { code: withSource(github), filename },
    { code: withSource(github), filename: local },
    {
      code: marketplaces({
        'acme-tools': { source: github },
        'security-plugins': {
          source: { source: 'git', url: 'https://git.example.com/security/plugins.git' },
        },
      }),
      filename,
    },
    // Each loadable type with its optional fields.
    {
      code: withSource({
        source: 'github',
        repo: 'acme/p',
        ref: 'main',
        path: 'marketplace',
        sparsePaths: ['.claude-plugin', 'plugins'],
        skipLfs: true,
      }),
      filename,
    },
    {
      code: withSource({ source: 'git', url: 'git@git.example.com:t/p.git', ref: 'v1' }),
      filename,
    },
    { code: withSource({ source: 'git', url: 'x', path: 'm', sparsePaths: [] }), filename },
    {
      code: withSource({
        source: 'url',
        url: 'https://plugins.example.com/marketplace.json',
        headers: { Authorization: `Bearer \${TOKEN}` },
        headersHelper: '/opt/bin/mint-token',
      }),
      filename,
    },
    { code: withSource({ source: 'url', url: '' }), filename },
    {
      code: withSource({ source: 'file', path: './m/.claude-plugin/marketplace.json' }),
      filename,
    },
    {
      code: withSource({ source: 'file', path: '/opt/acme/.claude-plugin/marketplace.json' }),
      filename,
    },
    {
      code: withSource({ source: 'file', path: '.claude-plugin/marketplace.json' }),
      filename,
    },
    {
      code: withSource({ source: 'file', path: 'C:\\m\\.claude-plugin\\marketplace.json' }),
      filename,
    },
    { code: withSource({ source: 'directory', path: '/opt/acme/marketplaces' }), filename },
    { code: withSource({ source: 'directory', path: '' }), filename },
    { code: withSource({ source: 'directory', path: '/opt/m', extra: 1 }), filename },
    // A `settings` source: the name equals the key, and an item has an object `source`.
    { code: withSource(inline({})), filename },
    { code: withSource(inline({ owner: { name: 'Acme' } })), filename },
    { code: withItem(goodItem), filename },
    {
      code: withItem({
        ...goodItem,
        description: 'd',
        version: '1.0.0',
        strict: false,
        headers: { Authorization: 'Bearer x' },
        headersHelper: '/opt/bin/mint',
        unknown: 1,
      }),
      filename,
    },
    // The name of a `settings` source can be close to a reserved name without being one.
    {
      code: marketplaces({
        'my-claude-plugins': { source: inline({ name: 'my-claude-plugins' }) },
      }),
      filename,
    },
    // `autoUpdate`.
    { code: marketplaces({ acme: { source: github, autoUpdate: true } }), filename },
    { code: marketplaces({ acme: { source: github, autoUpdate: false } }), filename },
    // Nothing to read.
    { code: marketplaces({}), filename },
    { code: JSON.stringify({ model: 'opus' }), filename },
    { code: '[]', filename },
    // The type of `extraKnownMarketplaces` itself is not checked.
    { code: marketplaces('acme'), filename },
    { code: marketplaces([github]), filename },
    { code: marketplaces(null), filename },
    // Two `extraKnownMarketplaces` keys, and two members with one name. The rule reads the last.
    {
      code: `{"extraKnownMarketplaces": {"acme": 1}, "extraKnownMarketplaces": {"acme": {"source": ${JSON.stringify(github)}}}}`,
      filename,
    },
    {
      code: `{"extraKnownMarketplaces": {"acme": 1, "acme": {"source": ${JSON.stringify(github)}}}}`,
      filename,
    },
    // Two `source` keys, and two `repo` keys. The rule reads the last.
    {
      code: '{"extraKnownMarketplaces": {"a": {"source": {"source": "npm"}, "source": {"source": "github", "repo": "o/r", "repo": "o/r"}}}}',
      filename,
    },
  ],
  invalid: [],
})

jsonTester.run('settings-extra-known-marketplaces-schema (invalid entry)', rule, {
  valid: [],
  invalid: [
    ...['"acme"', '[]', 'null', '3', 'true'].map((value) => ({
      code: `{"extraKnownMarketplaces": {"acme": ${value}}}`,
      filename,
      errors: [{ messageId: 'valueNotObject' as const, data: { key: 'acme' } }],
    })),
    {
      code: marketplaces({ acme: {} }),
      filename,
      errors: [
        { messageId: 'sourceMissing', data: { key: 'acme' }, line: 1, column: 35, endColumn: 37 },
      ],
    },
    {
      code: marketplaces({ acme: { autoUpdate: true } }),
      filename: local,
      errors: [{ messageId: 'sourceMissing', data: { key: 'acme' } }],
    },
    ...['"github"', 'null', '[]', '3'].map((value) => ({
      code: `{"extraKnownMarketplaces": {"acme": {"source": ${value}}}}`,
      filename,
      errors: [{ messageId: 'sourceNotObject' as const, data: { key: 'acme' } }],
    })),
    {
      code: marketplaces({ acme: { source: github, autoUpdate: 'yes' } }),
      filename,
      errors: [{ messageId: 'autoUpdateType', data: { key: 'acme' } }],
    },
    {
      code: marketplaces({ acme: { source: github, autoUpdate: null } }),
      filename,
      errors: [{ messageId: 'autoUpdateType', data: { key: 'acme' } }],
    },
    // A bad entry and a bad entry: one report for each, and a good entry gets none.
    {
      code: marketplaces({ a: 1, b: { source: github }, c: {} }),
      filename,
      errors: [
        { messageId: 'valueNotObject', data: { key: 'a' } },
        { messageId: 'sourceMissing', data: { key: 'c' } },
      ],
    },
    // Two members with one name. The rule reads the last.
    {
      code: `{"extraKnownMarketplaces": {"acme": {"source": ${JSON.stringify(github)}}, "acme": 1}}`,
      filename,
      errors: [{ messageId: 'valueNotObject', data: { key: 'acme' } }],
    },
    {
      code: '{"extraKnownMarketplaces": {"a": 1}, "extraKnownMarketplaces": {"b": 2}}',
      filename,
      errors: [{ messageId: 'valueNotObject', data: { key: 'b' } }],
    },
  ],
})

jsonTester.run('settings-extra-known-marketplaces-schema (invalid type)', rule, {
  valid: [],
  invalid: [
    {
      code: withSource({}),
      filename,
      errors: [{ messageId: 'typeMissing', data: { types }, line: 1, column: 45, endColumn: 47 }],
    },
    {
      code: withSource({ source: 5 }),
      filename,
      errors: [{ messageId: 'typeNotString', data: { types }, line: 1, column: 55 }],
    },
    { code: withSource({ source: null }), filename, errors: [{ messageId: 'typeNotString' }] },
    {
      code: withSource({ source: 'gitlab' }),
      filename,
      errors: [{ messageId: 'typeUnknown', data: { type: 'gitlab', types } }],
    },
    {
      code: withSource({ source: '' }),
      filename,
      errors: [{ messageId: 'typeUnknown', data: { type: '', types } }],
    },
    // The plugin source types are not marketplace source types.
    {
      code: withSource({ source: 'git-subdir', url: 'x', path: 'p' }),
      filename,
      errors: [{ messageId: 'typeUnknown', data: { type: 'git-subdir', types } }],
    },
    {
      code: withSource({ source: 'GitHub', repo: 'o/r' }),
      filename,
      errors: [{ messageId: 'typeUnknown', data: { type: 'GitHub', types } }],
    },
    // The types that only the policy lists take, and `npm`.
    {
      code: withSource({ source: 'npm', package: '@acme/marketplace' }),
      filename,
      errors: [{ messageId: 'typeNpm', data: { types } }],
    },
    {
      code: withSource({ source: 'skills-dir' }),
      filename,
      errors: [{ messageId: 'typeUnloaded', data: { type: 'skills-dir', types } }],
    },
    {
      code: withSource({ source: 'hostPattern', hostPattern: '^github\\.example\\.com$' }),
      filename,
      errors: [{ messageId: 'typeUnloaded', data: { type: 'hostPattern', types } }],
    },
    {
      code: withSource({ source: 'pathPattern', pathPattern: '^/opt/approved/' }),
      filename: local,
      errors: [{ messageId: 'typeUnloaded', data: { type: 'pathPattern', types } }],
    },
  ],
})

jsonTester.run('settings-extra-known-marketplaces-schema (invalid github and git)', rule, {
  valid: [],
  invalid: [
    {
      code: withSource({ source: 'github' }),
      filename,
      errors: [
        { messageId: 'missingField', data: { type: 'github', field: 'repo' }, line: 1, column: 45 },
      ],
    },
    {
      code: withSource({ source: 'github', repo: 5 }),
      filename,
      errors: [
        {
          messageId: 'fieldType',
          data: { type: 'github', field: 'repo', expected: 'a string' },
          line: 1,
          column: 71,
        },
      ],
    },
    // The owner wildcard is for the policy lists.
    ...['acme-corp/*', '*', '*/plugins', 'acme-corp/tools-*'].map((repo) => ({
      code: withSource({ source: 'github', repo }),
      filename,
      errors: [{ messageId: 'repoWildcard' as const, data: { value: repo } }],
    })),
    ...['plugins', '', 'a/b/c', 'acme corp/p', '/p', 'a/'].map((repo) => ({
      code: withSource({ source: 'github', repo }),
      filename,
      errors: [{ messageId: 'repoForm' as const, data: { value: repo } }],
    })),
    {
      code: withSource({ source: 'github', repo: 'o/r', ref: 1, path: [], sparsePaths: 'a' }),
      filename,
      errors: [
        { messageId: 'fieldType', data: { type: 'github', field: 'ref', expected: 'a string' } },
        { messageId: 'fieldType', data: { type: 'github', field: 'path', expected: 'a string' } },
        {
          messageId: 'fieldType',
          data: { type: 'github', field: 'sparsePaths', expected: 'an array of strings' },
        },
      ],
    },
    {
      code: withSource({ source: 'github', repo: 'o/r', sparsePaths: ['a', 1] }),
      filename,
      errors: [{ messageId: 'fieldType' }],
    },
    {
      code: withSource({ source: 'git' }),
      filename,
      errors: [{ messageId: 'missingField', data: { type: 'git', field: 'url' } }],
    },
    {
      code: withSource({ source: 'git', url: 5, ref: false }),
      filename,
      errors: [
        { messageId: 'fieldType', data: { type: 'git', field: 'url', expected: 'a string' } },
        { messageId: 'fieldType', data: { type: 'git', field: 'ref', expected: 'a string' } },
      ],
    },
    // Two `repo` keys. The rule reads the last.
    {
      code: '{"extraKnownMarketplaces": {"a": {"source": {"source": "github", "repo": "o/r", "repo": "x"}}}}',
      filename,
      errors: [{ messageId: 'repoForm', data: { value: 'x' } }],
    },
  ],
})

jsonTester.run('settings-extra-known-marketplaces-schema (invalid url, file and directory)', rule, {
  valid: [],
  invalid: [
    {
      code: withSource({ source: 'url' }),
      filename,
      errors: [{ messageId: 'missingField', data: { type: 'url', field: 'url' } }],
    },
    {
      code: withSource({ source: 'url', url: ['https://x.test'], headers: [], headersHelper: 5 }),
      filename,
      errors: [
        { messageId: 'fieldType', data: { type: 'url', field: 'url', expected: 'a string' } },
        { messageId: 'fieldType', data: { type: 'url', field: 'headers', expected: 'an object' } },
        {
          messageId: 'fieldType',
          data: { type: 'url', field: 'headersHelper', expected: 'a string' },
        },
      ],
    },
    {
      code: withSource({ source: 'file' }),
      filename,
      errors: [{ messageId: 'missingField', data: { type: 'file', field: 'path' } }],
    },
    {
      code: withSource({ source: 'file', path: 7 }),
      filename,
      errors: [
        { messageId: 'fieldType', data: { type: 'file', field: 'path', expected: 'a string' } },
      ],
    },
    // The docs say to keep the file at `<root>/.claude-plugin/marketplace.json`.
    ...[
      './m/marketplace.json',
      '',
      '/opt/acme/x.claude-plugin/marketplace.json',
      '/opt/acme/.claude-plugin/marketplace.json.bak',
      '/opt/acme/.claude-plugin/other.json',
    ].map((path) => ({
      code: withSource({ source: 'file', path }),
      filename,
      errors: [{ messageId: 'filePath' as const }],
    })),
    {
      code: withSource({ source: 'directory' }),
      filename,
      errors: [{ messageId: 'missingField', data: { type: 'directory', field: 'path' } }],
    },
    {
      code: withSource({ source: 'directory', path: null }),
      filename,
      errors: [
        {
          messageId: 'fieldType',
          data: { type: 'directory', field: 'path', expected: 'a string' },
        },
      ],
    },
  ],
})

jsonTester.run('settings-extra-known-marketplaces-schema (invalid settings source)', rule, {
  valid: [],
  invalid: [
    {
      code: withSource({ source: 'settings', plugins: [] }),
      filename,
      errors: [{ messageId: 'missingField', data: { type: 'settings', field: 'name' } }],
    },
    {
      code: withSource({ source: 'settings', name: 'acme' }),
      filename,
      errors: [{ messageId: 'missingField', data: { type: 'settings', field: 'plugins' } }],
    },
    {
      code: withSource(inline({ name: 5, plugins: {} })),
      filename,
      errors: [
        { messageId: 'fieldType', data: { type: 'settings', field: 'name', expected: 'a string' } },
        {
          messageId: 'fieldType',
          data: { type: 'settings', field: 'plugins', expected: 'an array' },
        },
      ],
    },
    // The name must equal the key.
    {
      code: withSource(inline({ name: 'other' })),
      filename,
      errors: [{ messageId: 'nameMismatch', data: { key: 'acme', name: 'other' } }],
    },
    {
      code: withSource(inline({ name: '' })),
      filename,
      errors: [{ messageId: 'nameMismatch', data: { key: 'acme', name: '' } }],
    },
    {
      code: withSource(inline({ name: 'Acme' })),
      filename,
      errors: [{ messageId: 'nameMismatch', data: { key: 'acme', name: 'Acme' } }],
    },
    // The name must not be reserved. Each kind of reserved name gives a report.
    ...[
      'claude-plugins-official',
      'inline',
      'skills-dir',
      'synced',
      'claude-plugin-test',
      'npm',
      'NPM',
      'Gh',
      'claudeai-team',
      'claude.code.plugins',
    ].map((name) => ({
      code: marketplaces({ [name]: { source: inline({ name }) } }),
      filename,
      errors: [{ messageId: 'nameReserved' as const, data: { name } }],
    })),
    // A name that is wrong in both ways gives two reports.
    {
      code: withSource(inline({ name: 'inline' })),
      filename,
      errors: [
        { messageId: 'nameMismatch', data: { key: 'acme', name: 'inline' } },
        { messageId: 'nameReserved', data: { name: 'inline' } },
      ],
    },
    // The items of `plugins`.
    {
      code: withSource(inline({ plugins: ['formatter', null, [], goodItem] })),
      filename,
      errors: [
        { messageId: 'pluginNotObject' },
        { messageId: 'pluginNotObject' },
        { messageId: 'pluginNotObject' },
      ],
    },
    {
      code: withItem({ name: 'formatter' }),
      filename,
      errors: [{ messageId: 'pluginSource' }],
    },
    // A relative path has no repository to resolve against.
    {
      code: withItem({ name: 'formatter', source: './plugins/formatter' }),
      filename,
      errors: [{ messageId: 'pluginSource' }],
    },
    {
      code: withItem({ name: 'formatter', source: '' }),
      filename,
      errors: [{ messageId: 'pluginSource' }],
    },
    {
      code: withItem({ name: 'f', source: null }),
      filename,
      errors: [{ messageId: 'pluginSource' }],
    },
    {
      code: withItem({ name: 'f', source: [] }),
      filename,
      errors: [{ messageId: 'pluginSource' }],
    },
    {
      code: withItem({
        source: {},
        name: 1,
        description: 2,
        version: 3,
        strict: 'false',
        headers: [],
        headersHelper: 4,
      }),
      filename,
      errors: [
        { messageId: 'pluginFieldType', data: { field: 'name', expected: 'a string' } },
        { messageId: 'pluginFieldType', data: { field: 'description', expected: 'a string' } },
        { messageId: 'pluginFieldType', data: { field: 'version', expected: 'a string' } },
        { messageId: 'pluginFieldType', data: { field: 'strict', expected: 'true or false' } },
        { messageId: 'pluginFieldType', data: { field: 'headers', expected: 'an object' } },
        { messageId: 'pluginFieldType', data: { field: 'headersHelper', expected: 'a string' } },
      ],
    },
  ],
})

json5Tester.run('settings-extra-known-marketplaces-schema (JSON5 valid)', rule, {
  valid: [
    {
      code: "{ extraKnownMarketplaces: { acme: { source: { source: 'github', repo: 'o/r' } } } }",
      filename,
    },
    {
      code: "{ extraKnownMarketplaces: { acme: { source: { source: 'settings', name: 'acme', plugins: [] } } } }",
      filename,
    },
  ],
  invalid: [],
})

json5Tester.run('settings-extra-known-marketplaces-schema (JSON5 invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: "{ extraKnownMarketplaces: { acme: { source: { source: 'settings', name: 'other', plugins: [] } } } }",
      filename,
      errors: [{ messageId: 'nameMismatch', data: { key: 'acme', name: 'other' } }],
    },
    {
      code: '{ extraKnownMarketplaces: { acme: 1 } }',
      filename,
      errors: [{ messageId: 'valueNotObject', data: { key: 'acme' } }],
    },
  ],
})
