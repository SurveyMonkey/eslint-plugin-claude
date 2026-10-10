// The rule reads the top-level keys of `.claude/settings.json` and
// `.claude/settings.local.json`. The files glob and the decoy files are in
// tests/configs.test.ts.
import { expect, it } from 'vitest'
import { json5Tester, jsonTester, lintJson, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-marketplace-key-alias-conflict')

const filename = '.claude/settings.json'
const local = '.claude/settings.local.json'
const source = { 'acme-tools': { source: { source: 'github', repo: 'acme-corp/claude-plugins' } } }
const policy = [{ source: 'github', repo: 'acme-corp/claude-plugins' }]

jsonTester.run('settings-marketplace-key-alias-conflict (valid)', rule, {
  valid: [
    // One spelling of the pair, in each file.
    { code: JSON.stringify({ extraKnownMarketplaces: source }), filename },
    { code: JSON.stringify({ additionalMarketplaces: source }), filename },
    { code: JSON.stringify({ strictKnownMarketplaces: policy }), filename: local },
    { code: JSON.stringify({ allowedMarketplaces: policy }), filename: local },
    // The policy pair is not checked: `strictKnownMarketplaces` has the scope "Managed".
    {
      code: JSON.stringify({ strictKnownMarketplaces: policy, allowedMarketplaces: policy }),
      filename,
    },
    {
      code: JSON.stringify({ allowedMarketplaces: policy, strictKnownMarketplaces: policy }),
      filename: local,
    },
    { code: '{"strictKnownMarketplaces": [], "allowedMarketplaces": []}', filename },
    // One spelling of the pair with a policy key is no conflict.
    {
      code: JSON.stringify({ extraKnownMarketplaces: source, allowedMarketplaces: policy }),
      filename,
    },
    {
      code: JSON.stringify({ additionalMarketplaces: source, strictKnownMarketplaces: policy }),
      filename,
    },
    // The two aliases, or the two canonical keys, are not the pair.
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
    // A key counts as set for any value.
    {
      code: '{"extraKnownMarketplaces": null, "additionalMarketplaces": {}}',
      filename,
      errors: [{ messageId: 'conflict' }],
    },
    {
      code: '{"extraKnownMarketplaces": "", "additionalMarketplaces": ""}',
      filename,
      errors: [{ messageId: 'conflict' }],
    },
    {
      code: '{"extraKnownMarketplaces": 0, "additionalMarketplaces": false}',
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
      code: '{ extraKnownMarketplaces: {}, additionalMarketplaces: {} }',
      filename,
      errors: [{ messageId: 'conflict' }],
    },
  ],
})

jsonTester.run('settings-marketplace-key-alias-conflict (message text)', rule, {
  valid: [],
  invalid: [
    {
      code: JSON.stringify({ extraKnownMarketplaces: source, additionalMarketplaces: source }),
      filename,
      errors: [
        {
          message:
            'This file sets "additionalMarketplaces" and "extraKnownMarketplaces". Claude Code uses the value of "extraKnownMarketplaces" and ignores "additionalMarketplaces".',
        },
      ],
    },
  ],
})

// Red first: the managed files do not get the policy pair yet. The `.fails` mark goes away with the
// rule change.
it.fails('reports the policy pair in a managed file', () => {
  const messages = lintJson(
    'settings-marketplace-key-alias-conflict',
    '{"strictKnownMarketplaces":[],"allowedMarketplaces":[]}',
    'managed-settings.json',
  )
  expect(messages.map((m) => m.messageId)).toEqual(['conflict'])
})
