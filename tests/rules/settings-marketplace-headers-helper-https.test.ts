// The rule reads the `url` sources of `extraKnownMarketplaces` in
// `.claude/settings.json` and `.claude/settings.local.json`. The files glob and
// the decoy files are in tests/configs.test.ts.
import { json5Tester, jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-marketplace-headers-helper-https')

const filename = '.claude/settings.json'
const local = '.claude/settings.local.json'
const marketplaces = (value: unknown) => JSON.stringify({ extraKnownMarketplaces: value })
/** A marketplace `acme` with a `url` source. */
const urlSource = (fields: Record<string, unknown>) =>
  marketplaces({ acme: { source: { source: 'url', ...fields } } })

jsonTester.run('settings-marketplace-headers-helper-https (valid)', rule, {
  valid: [
    {
      code: urlSource({
        url: 'https://plugins.example.com/marketplace.json',
        headersHelper: '/opt/bin/mint',
      }),
      filename,
    },
    {
      code: urlSource({ url: 'https://x.test/m.json', headersHelper: '/opt/bin/mint' }),
      filename: local,
    },
    // The scheme is not case sensitive, and `https://` alone starts with `https://`.
    { code: urlSource({ url: 'HTTPS://x.test/m.json', headersHelper: 'mint' }), filename },
    { code: urlSource({ url: 'https://', headersHelper: 'mint' }), filename },
    // With no `headersHelper`, the command never runs, so the URL scheme does not matter here.
    { code: urlSource({ url: 'http://x.test/m.json' }), filename },
    { code: urlSource({ url: 'http://x.test/m.json', headers: { Authorization: 'x' } }), filename },
    { code: urlSource({ url: '' }), filename },
    // A source of another type, or an entry that is not a source, is not read.
    {
      code: marketplaces({
        acme: { source: { source: 'git', url: 'http://x.test/r.git', headersHelper: 'mint' } },
      }),
      filename,
    },
    {
      code: marketplaces({
        acme: { source: { source: 'settings', name: 'acme', plugins: [], headersHelper: 'mint' } },
      }),
      filename,
    },
    {
      code: marketplaces({ acme: { source: { headersHelper: 'mint', url: 'http://x' } } }),
      filename,
    },
    // A value of the wrong type is for `settings-extra-known-marketplaces-schema`.
    { code: urlSource({ url: 5, headersHelper: 'mint' }), filename },
    { code: urlSource({ headersHelper: 'mint' }), filename },
    { code: urlSource({ url: ['http://x'], headersHelper: 'mint' }), filename },
    { code: marketplaces({ acme: { source: 'http://x' } }), filename },
    { code: marketplaces({ acme: 'http://x' }), filename },
    { code: marketplaces('http://x'), filename },
    {
      code: marketplaces({
        acme: { source: { source: 5, headersHelper: 'mint', url: 'http://x' } },
      }),
      filename,
    },
    { code: JSON.stringify({ model: 'opus' }), filename },
    { code: '[]', filename },
    // Two members with one name, and two `url` keys. The rule reads the last.
    {
      code: '{"extraKnownMarketplaces": {"a": {"source": {"source": "url", "url": "http://x", "headersHelper": "m"}}, "a": {"source": {"source": "url", "url": "https://x", "headersHelper": "m"}}}}',
      filename,
    },
    {
      code: '{"extraKnownMarketplaces": {"a": {"source": {"source": "url", "url": "http://x", "url": "https://x", "headersHelper": "m"}}}}',
      filename,
    },
  ],
  invalid: [],
})

jsonTester.run('settings-marketplace-headers-helper-https (invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: urlSource({ url: 'http://x.test/m.json', headersHelper: '/opt/bin/mint' }),
      filename,
      errors: [{ messageId: 'notHttps', line: 1, column: 67, endColumn: 89 }],
    },
    {
      code: urlSource({ url: 'http://x.test/m.json', headersHelper: '/opt/bin/mint' }),
      filename: local,
      errors: [{ messageId: 'notHttps' }],
    },
    ...[
      'ftp://x.test/m.json',
      'git@x.test:m.git',
      'x.test/m.json',
      '//x.test/m.json',
      ' https://x.test',
      'https:/x.test',
      'http://https://',
      '',
    ].map((url) => ({
      code: urlSource({ url, headersHelper: 'mint' }),
      filename,
      errors: [{ messageId: 'notHttps' as const }],
    })),
    // `headersHelper` counts as set for any value.
    ...['', null, 5, [], {}, false].map((headersHelper) => ({
      code: urlSource({ url: 'http://x.test/m.json', headersHelper }),
      filename,
      errors: [{ messageId: 'notHttps' as const }],
    })),
    // The order of the keys does not matter.
    {
      code: marketplaces({
        acme: { source: { headersHelper: 'mint', url: 'http://x.test', source: 'url' } },
      }),
      filename,
      errors: [{ messageId: 'notHttps' }],
    },
    // One report for each marketplace.
    {
      code: marketplaces({
        a: { source: { source: 'url', url: 'http://a.test', headersHelper: 'm' } },
        b: { source: { source: 'url', url: 'https://b.test', headersHelper: 'm' } },
        c: { source: { source: 'url', url: 'http://c.test', headersHelper: 'm' } },
      }),
      filename,
      errors: [
        { messageId: 'notHttps', column: 64 },
        { messageId: 'notHttps', column: 213 },
      ],
    },
    // Two members with one name, and two keys. The rule reads the last.
    {
      code: '{"extraKnownMarketplaces": {"a": {"source": {"source": "url", "url": "https://x", "headersHelper": "m"}}, "a": {"source": {"source": "url", "url": "http://x", "headersHelper": "m"}}}}',
      filename,
      errors: [{ messageId: 'notHttps' }],
    },
    {
      code: '{"extraKnownMarketplaces": {"a": {"source": {"source": "url", "url": "https://x", "url": "http://x", "headersHelper": "m"}}}}',
      filename,
      errors: [{ messageId: 'notHttps' }],
    },
    {
      code: '{"extraKnownMarketplaces": {"a": {"source": {"source": "url", "url": "http://x", "headersHelper": "a", "headersHelper": "b"}}}}',
      filename,
      errors: [{ messageId: 'notHttps' }],
    },
  ],
})

json5Tester.run('settings-marketplace-headers-helper-https (JSON5 valid)', rule, {
  valid: [
    {
      code: "{ extraKnownMarketplaces: { acme: { source: { source: 'url', url: 'https://x', headersHelper: 'm' } } } }",
      filename,
    },
  ],
  invalid: [],
})

json5Tester.run('settings-marketplace-headers-helper-https (JSON5 invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: "{ extraKnownMarketplaces: { acme: { source: { source: 'url', url: 'http://x', headersHelper: 'm' } } } }",
      filename,
      errors: [{ messageId: 'notHttps' }],
    },
  ],
})
