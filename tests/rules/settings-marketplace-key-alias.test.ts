// The rule reads the top-level keys of the project settings files and of the managed settings
// files. The files globs and the decoy files are in tests/configs.test.ts.
import { json5Tester, jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-marketplace-key-alias')
const filename = '.claude/settings.json'
const local = '.claude/settings.local.json'
const managed = 'managed-settings.json'
const dropIn = 'managed-settings.d/10-a.json'
const json = JSON.stringify
const source = { 'acme-tools': { source: { source: 'github', repo: 'acme-corp/claude-plugins' } } }
const policy = [{ source: 'github', repo: 'acme-corp/claude-plugins' }]

jsonTester.run('settings-marketplace-key-alias (valid)', rule, {
  valid: [
    // The canonical key, in each file.
    { code: json({ extraKnownMarketplaces: source }), filename },
    { code: json({ extraKnownMarketplaces: source }), filename: local },
    { code: json({ extraKnownMarketplaces: source }), filename: managed },
    { code: json({ strictKnownMarketplaces: policy }), filename: managed },
    { code: json({ strictKnownMarketplaces: policy }), filename: dropIn },
    // An alias beside its canonical key is for `settings-marketplace-key-alias-conflict`.
    {
      code: json({ extraKnownMarketplaces: source, additionalMarketplaces: source }),
      filename,
    },
    {
      code: json({ additionalMarketplaces: source, extraKnownMarketplaces: source }),
      filename: managed,
    },
    {
      code: json({ strictKnownMarketplaces: policy, allowedMarketplaces: policy }),
      filename: managed,
    },
    // `allowedMarketplaces` in a project file is for `settings-key-scope`: the key is managed.
    { code: json({ allowedMarketplaces: policy }), filename },
    { code: json({ allowedMarketplaces: policy }), filename: local },
    // The canonical key of one pair does not stand for the alias of the other.
    { code: json({ extraKnownMarketplaces: source, allowedMarketplaces: policy }), filename },
    // A key inside a value is not a key of the file.
    { code: json({ extraKnownMarketplaces: { additionalMarketplaces: 1 } }), filename },
    { code: json({ model: 'opus' }), filename },
    { code: '{}', filename },
    { code: '[]', filename },
    { code: '"additionalMarketplaces"', filename },
    // Claude Code ignores a hidden drop-in, so it reads no key there.
    {
      code: json({ additionalMarketplaces: source, allowedMarketplaces: policy }),
      filename: 'managed-settings.d/.10-a.json',
    },
  ],
  invalid: [],
})

jsonTester.run('settings-marketplace-key-alias (invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: json({ additionalMarketplaces: source }),
      filename,
      errors: [
        {
          messageId: 'alias',
          data: { alias: 'additionalMarketplaces', canonical: 'extraKnownMarketplaces' },
          line: 1,
          column: 2,
          endColumn: 26,
        },
      ],
    },
    {
      code: json({ additionalMarketplaces: source }),
      filename: local,
      errors: [{ messageId: 'alias' }],
    },
    // The canonical key of one pair does not stand for the alias of the other, in a managed file.
    {
      code: json({ strictKnownMarketplaces: policy, additionalMarketplaces: source }),
      filename: managed,
      errors: [
        {
          messageId: 'alias',
          data: { alias: 'additionalMarketplaces', canonical: 'extraKnownMarketplaces' },
        },
      ],
    },
    {
      code: json({ extraKnownMarketplaces: source, allowedMarketplaces: policy }),
      filename: managed,
      errors: [
        {
          messageId: 'alias',
          data: { alias: 'allowedMarketplaces', canonical: 'strictKnownMarketplaces' },
        },
      ],
    },
    // A managed file also gets `allowedMarketplaces`.
    {
      code: json({ additionalMarketplaces: source }),
      filename: managed,
      errors: [{ messageId: 'alias' }],
    },
    {
      code: json({ allowedMarketplaces: policy }),
      filename: managed,
      errors: [
        {
          messageId: 'alias',
          data: { alias: 'allowedMarketplaces', canonical: 'strictKnownMarketplaces' },
          line: 1,
          column: 2,
          endColumn: 23,
        },
      ],
    },
    {
      code: json({ allowedMarketplaces: policy }),
      filename: dropIn,
      errors: [{ messageId: 'alias' }],
    },
    // A key counts as set for any value.
    { code: '{"additionalMarketplaces": null}', filename, errors: [{ messageId: 'alias' }] },
    { code: '{"allowedMarketplaces": []}', filename: managed, errors: [{ messageId: 'alias' }] },
    // One report for each alias.
    {
      code: json({ additionalMarketplaces: source, allowedMarketplaces: policy }),
      filename: managed,
      errors: [
        {
          messageId: 'alias',
          data: { alias: 'additionalMarketplaces', canonical: 'extraKnownMarketplaces' },
        },
        {
          messageId: 'alias',
          data: { alias: 'allowedMarketplaces', canonical: 'strictKnownMarketplaces' },
        },
      ],
    },
    // The project file: the alias of the extraKnownMarketplaces pair, and no more.
    {
      code: json({ additionalMarketplaces: source, allowedMarketplaces: policy }),
      filename,
      errors: [
        {
          messageId: 'alias',
          data: { alias: 'additionalMarketplaces', canonical: 'extraKnownMarketplaces' },
        },
      ],
    },
    // Two members with one alias name: one report, on the last, as `JSON.parse` keeps the last.
    {
      code: '{"additionalMarketplaces": 1, "additionalMarketplaces": 2}',
      filename,
      errors: [{ messageId: 'alias', column: 31 }],
    },
  ],
})

json5Tester.run('settings-marketplace-key-alias (JSON5 invalid)', rule, {
  valid: [],
  invalid: [
    { code: '{ additionalMarketplaces: {} }', filename, errors: [{ messageId: 'alias' }] },
    { code: "{ 'allowedMarketplaces': [] }", filename: managed, errors: [{ messageId: 'alias' }] },
  ],
})

jsonTester.run('settings-marketplace-key-alias (message text)', rule, {
  valid: [],
  invalid: [
    {
      code: json({ additionalMarketplaces: source }),
      filename,
      errors: [
        {
          message:
            'Write "extraKnownMarketplaces", not the alias "additionalMarketplaces". Claude Code before v2.1.232 ignores the alias.',
        },
      ],
    },
  ],
})
