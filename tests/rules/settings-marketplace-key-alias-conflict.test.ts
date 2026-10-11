// The rule reads the top-level keys of `.claude/settings.json`, `.claude/settings.local.json` and
// the managed settings files. A project file gets the `extraKnownMarketplaces` pair only, because
// `strictKnownMarketplaces` is a managed key. The files globs and the decoy files are in
// tests/configs.test.ts.
import { json5Tester, jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-marketplace-key-alias-conflict')

const filename = '.claude/settings.json'
const local = '.claude/settings.local.json'
const managed = 'managed-settings.json'
const dropIn = 'managed-settings.d/10-a.json'
const source = { 'acme-tools': { source: { source: 'github', repo: 'acme-corp/claude-plugins' } } }
const policy = [{ source: 'github', repo: 'acme-corp/claude-plugins' }]

jsonTester.run('settings-marketplace-key-alias-conflict (valid)', rule, {
  valid: [
    // One spelling of the pair, in each file.
    { code: JSON.stringify({ extraKnownMarketplaces: source }), filename },
    { code: JSON.stringify({ additionalMarketplaces: source }), filename },
    { code: JSON.stringify({ strictKnownMarketplaces: policy }), filename: local },
    { code: JSON.stringify({ allowedMarketplaces: policy }), filename: local },
    // A project file does not get the policy pair: `strictKnownMarketplaces` has the scope "Managed".
    {
      code: JSON.stringify({ strictKnownMarketplaces: policy, allowedMarketplaces: policy }),
      filename,
    },
    {
      code: JSON.stringify({ allowedMarketplaces: policy, strictKnownMarketplaces: policy }),
      filename: local,
    },
    { code: '{"strictKnownMarketplaces": [], "allowedMarketplaces": []}', filename },
    // A managed file with one spelling of each pair.
    { code: JSON.stringify({ strictKnownMarketplaces: policy }), filename: managed },
    { code: JSON.stringify({ allowedMarketplaces: policy }), filename: dropIn },
    {
      code: JSON.stringify({ extraKnownMarketplaces: source, allowedMarketplaces: policy }),
      filename: managed,
    },
    {
      code: JSON.stringify({ additionalMarketplaces: source, strictKnownMarketplaces: policy }),
      filename: dropIn,
    },
    // Claude Code ignores a hidden drop-in, so it reads no key there.
    {
      code: JSON.stringify({ strictKnownMarketplaces: policy, allowedMarketplaces: policy }),
      filename: 'managed-settings.d/.10-a.json',
    },
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
    // The managed files get the policy pair, and the other pair too.
    {
      code: JSON.stringify({ strictKnownMarketplaces: policy, allowedMarketplaces: policy }),
      filename: managed,
      errors: [
        {
          messageId: 'conflict',
          data: { alias: 'allowedMarketplaces', canonical: 'strictKnownMarketplaces' },
          line: 1,
          column: 84,
          endColumn: 105,
        },
      ],
    },
    {
      code: JSON.stringify({ allowedMarketplaces: policy, strictKnownMarketplaces: policy }),
      filename: dropIn,
      errors: [
        {
          messageId: 'conflict',
          data: { alias: 'allowedMarketplaces', canonical: 'strictKnownMarketplaces' },
          line: 1,
          column: 2,
          endColumn: 23,
        },
      ],
    },
    {
      code: JSON.stringify({ extraKnownMarketplaces: source, additionalMarketplaces: source }),
      filename: managed,
      errors: [{ messageId: 'conflict' }],
    },
    // A managed file with both pairs: one report for each pair.
    {
      code: JSON.stringify({
        extraKnownMarketplaces: source,
        additionalMarketplaces: source,
        strictKnownMarketplaces: policy,
        allowedMarketplaces: policy,
      }),
      filename: managed,
      errors: [
        {
          messageId: 'conflict',
          data: { alias: 'additionalMarketplaces', canonical: 'extraKnownMarketplaces' },
        },
        {
          messageId: 'conflict',
          data: { alias: 'allowedMarketplaces', canonical: 'strictKnownMarketplaces' },
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
