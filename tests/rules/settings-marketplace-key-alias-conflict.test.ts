// The rule reads the top-level keys of `.claude/settings.json` and
// `.claude/settings.local.json`. The files glob and the decoy files are in
// tests/configs.test.ts.
import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import plugin from '../../src/index.ts'
import { json5Tester, jsonTester } from '../rule-tester.test-support.ts'

// Red first: the rule is not in the plugin yet, so a stub with no checks stands in for it, and
// each case in an `invalid` block must fail. The rule commit removes the stub and the marks.
const rule = plugin.rules['settings-marketplace-key-alias-conflict'] ?? {
  meta: { schema: [], messages: {} },
  create: () => ({}),
}
let red = false
Object.assign(RuleTester, {
  describe: (title: string, factory: () => void) =>
    describe(title, () => {
      const before = red
      red = title === 'invalid' || before
      try {
        factory()
      } finally {
        red = before
      }
    }),
  it: (title: string, test: () => void) => (red ? it.fails : it)(title, test),
})

const filename = '.claude/settings.json'
const local = '.claude/settings.local.json'
const source = { 'acme-tools': { source: { source: 'github', repo: 'acme-corp/claude-plugins' } } }
const policy = [{ source: 'github', repo: 'acme-corp/claude-plugins' }]

jsonTester.run('settings-marketplace-key-alias-conflict (valid)', rule, {
  valid: [
    // One spelling of each pair.
    { code: JSON.stringify({ extraKnownMarketplaces: source }), filename },
    { code: JSON.stringify({ additionalMarketplaces: source }), filename },
    { code: JSON.stringify({ strictKnownMarketplaces: policy }), filename: local },
    { code: JSON.stringify({ allowedMarketplaces: policy }), filename: local },
    // One spelling from each pair is two pairs with no conflict.
    {
      code: JSON.stringify({ extraKnownMarketplaces: source, allowedMarketplaces: policy }),
      filename,
    },
    {
      code: JSON.stringify({ additionalMarketplaces: source, strictKnownMarketplaces: policy }),
      filename,
    },
    // The two aliases, or the two canonical keys, are not a pair.
    {
      code: JSON.stringify({ additionalMarketplaces: source, allowedMarketplaces: policy }),
      filename,
    },
    {
      code: JSON.stringify({ extraKnownMarketplaces: source, strictKnownMarketplaces: policy }),
      filename,
    },
    { code: JSON.stringify({ model: 'opus' }), filename },
    { code: '{}', filename },
    { code: '[]', filename },
    { code: '"additionalMarketplaces"', filename },
    // A key inside a value is not a key of the file.
    {
      code: JSON.stringify({ extraKnownMarketplaces: { additionalMarketplaces: 1 } }),
      filename,
    },
  ],
  invalid: [],
})

jsonTester.run('settings-marketplace-key-alias-conflict (invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: JSON.stringify({ extraKnownMarketplaces: source, additionalMarketplaces: source }),
      filename,
      errors: [
        {
          messageId: 'conflict',
          data: { alias: 'additionalMarketplaces', canonical: 'extraKnownMarketplaces' },
          line: 1,
          column: 107,
          endColumn: 131,
        },
      ],
    },
    // The report is on the alias, whichever key comes first.
    {
      code: JSON.stringify({ additionalMarketplaces: source, extraKnownMarketplaces: source }),
      filename: local,
      errors: [
        {
          messageId: 'conflict',
          data: { alias: 'additionalMarketplaces', canonical: 'extraKnownMarketplaces' },
          line: 1,
          column: 2,
          endColumn: 26,
        },
      ],
    },
    {
      code: JSON.stringify({ strictKnownMarketplaces: policy, allowedMarketplaces: policy }),
      filename,
      errors: [
        {
          messageId: 'conflict',
          data: { alias: 'allowedMarketplaces', canonical: 'strictKnownMarketplaces' },
        },
      ],
    },
    {
      code: JSON.stringify({ allowedMarketplaces: policy, strictKnownMarketplaces: policy }),
      filename: local,
      errors: [
        {
          messageId: 'conflict',
          data: { alias: 'allowedMarketplaces', canonical: 'strictKnownMarketplaces' },
          line: 1,
          column: 2,
        },
      ],
    },
    // Both pairs: one report for each.
    {
      code: JSON.stringify({
        extraKnownMarketplaces: source,
        strictKnownMarketplaces: policy,
        allowedMarketplaces: policy,
        additionalMarketplaces: source,
      }),
      filename,
      errors: [
        {
          messageId: 'conflict',
          data: { alias: 'allowedMarketplaces', canonical: 'strictKnownMarketplaces' },
        },
        {
          messageId: 'conflict',
          data: { alias: 'additionalMarketplaces', canonical: 'extraKnownMarketplaces' },
        },
      ],
    },
    // A key counts as set for any value.
    {
      code: '{"extraKnownMarketplaces": null, "additionalMarketplaces": {}}',
      filename,
      errors: [{ messageId: 'conflict' }],
    },
    {
      code: '{"strictKnownMarketplaces": [], "allowedMarketplaces": []}',
      filename,
      errors: [{ messageId: 'conflict' }],
    },
    {
      code: '{"extraKnownMarketplaces": "", "additionalMarketplaces": ""}',
      filename,
      errors: [{ messageId: 'conflict' }],
    },
    {
      code: '{"strictKnownMarketplaces": 0, "allowedMarketplaces": false}',
      filename,
      errors: [{ messageId: 'conflict' }],
    },
    // Two members with one alias name: one report, on the last, as `JSON.parse` keeps the last.
    {
      code: '{"additionalMarketplaces": 1, "extraKnownMarketplaces": 2, "additionalMarketplaces": 3}',
      filename,
      errors: [{ messageId: 'conflict', column: 60 }],
    },
  ],
})

json5Tester.run('settings-marketplace-key-alias-conflict (JSON5 invalid)', rule, {
  valid: [],
  invalid: [
    // Bare identifier keys and a quoted key.
    {
      code: "{ extraKnownMarketplaces: {}, 'additionalMarketplaces': {} }",
      filename,
      errors: [{ messageId: 'conflict' }],
    },
    {
      code: '{ strictKnownMarketplaces: [], allowedMarketplaces: [] }',
      filename,
      errors: [{ messageId: 'conflict' }],
    },
  ],
})
