// The rule reads `extraKnownMarketplaces` of the project settings files and of the managed settings
// files. The files globs and the decoy files are in tests/configs.test.ts.
import { json5Tester, jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-marketplace-skip-lfs')
const filename = '.claude/settings.json'
const local = '.claude/settings.local.json'
const managed = 'managed-settings.json'
const dropIn = 'managed-settings.d/10-a.json'
const json = JSON.stringify
const entry = (source: unknown) => ({ extraKnownMarketplaces: { acme: { source } } })
const github = { source: 'github', repo: 'acme-corp/claude-plugins' }

jsonTester.run('settings-marketplace-skip-lfs (valid)', rule, {
  valid: [
    { code: json(entry(github)), filename },
    { code: json(entry({ source: 'git', url: 'https://git.test/p.git', ref: 'main' })), filename },
    // `skipLfs` outside a `github` or `git` source: the docs list the field for those two types.
    { code: json(entry({ source: 'url', url: 'https://x.test/m.json', skipLfs: true })), filename },
    { code: json(entry({ source: 'file', path: '/m.json', skipLfs: true })), filename },
    { code: json(entry({ source: 'GitHub', repo: 'a/b', skipLfs: true })), filename },
    { code: json(entry({ repo: 'a/b', skipLfs: true })), filename },
    { code: json(entry({ source: 1, skipLfs: true })), filename },
    // `skipLfs` is no member of the entry, or of the policy lists.
    {
      code: json({ extraKnownMarketplaces: { acme: { source: github, skipLfs: true } } }),
      filename,
    },
    { code: json({ strictKnownMarketplaces: [{ ...github, skipLfs: true }] }), filename: managed },
    { code: json({ skipLfs: true }), filename },
    // A value that the schema rule reports.
    { code: json(entry('github')), filename },
    { code: json(entry(null)), filename },
    { code: json({ extraKnownMarketplaces: { acme: null } }), filename },
    { code: json({ extraKnownMarketplaces: ['x'] }), filename },
    { code: json({ extraKnownMarketplaces: null }), filename },
    { code: '{}', filename },
    { code: '[]', filename },
    // The alias is ignored when the canonical key is set.
    {
      code: json({
        extraKnownMarketplaces: {},
        additionalMarketplaces: entry({ ...github, skipLfs: true }).extraKnownMarketplaces,
      }),
      filename,
    },
    // A canonical key set to `null` is set, so the alias is ignored.
    {
      code: json({
        extraKnownMarketplaces: null,
        additionalMarketplaces: entry({ ...github, skipLfs: true }).extraKnownMarketplaces,
      }),
      filename,
    },
    // Only the entry of the last member of a key counts.
    {
      code: `{"extraKnownMarketplaces": {"acme": ${json({ source: { ...github, skipLfs: true } })}, "acme": ${json({ source: github })}}}`,
      filename,
    },
    // Claude Code ignores a hidden drop-in, so it reads no key there.
    {
      code: json(entry({ ...github, skipLfs: true })),
      filename: 'managed-settings.d/.10-a.json',
    },
  ],
  invalid: [],
})

jsonTester.run('settings-marketplace-skip-lfs (invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: json(entry({ ...github, skipLfs: true })),
      filename,
      errors: [{ messageId: 'skipLfs', line: 1, column: 98, endColumn: 107 }],
    },
    {
      code: json(entry({ ...github, skipLfs: false })),
      filename: local,
      errors: [{ messageId: 'skipLfs' }],
    },
    {
      code: json(entry({ source: 'git', url: 'https://git.test/p.git', skipLfs: 1 })),
      filename,
      errors: [{ messageId: 'skipLfs' }],
    },
    // The managed files.
    {
      code: json(entry({ ...github, skipLfs: true })),
      filename: managed,
      errors: [{ messageId: 'skipLfs' }],
    },
    {
      code: json(entry({ ...github, skipLfs: true })),
      filename: dropIn,
      errors: [{ messageId: 'skipLfs' }],
    },
    // The alias, when the canonical key is not there.
    {
      code: json({
        additionalMarketplaces: entry({ ...github, skipLfs: true }).extraKnownMarketplaces,
      }),
      filename,
      errors: [{ messageId: 'skipLfs' }],
    },
    // One report for each entry that sets the field.
    {
      code: json({
        extraKnownMarketplaces: {
          a: { source: { ...github, skipLfs: true } },
          b: { source: github },
          c: { source: { ...github, skipLfs: true } },
        },
      }),
      filename,
      errors: [{ messageId: 'skipLfs' }, { messageId: 'skipLfs' }],
    },
    // Two members of one key: the last counts, as `JSON.parse` keeps the last.
    {
      code: `{"extraKnownMarketplaces": {"acme": ${json({ source: github })}, "acme": ${json({ source: { ...github, skipLfs: true } })}}}`,
      filename,
      errors: [{ messageId: 'skipLfs' }],
    },
  ],
})

json5Tester.run('settings-marketplace-skip-lfs (JSON5 invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: "{ extraKnownMarketplaces: { acme: { source: { source: 'github', repo: 'a/b', skipLfs: true } } } }",
      filename,
      errors: [{ messageId: 'skipLfs' }],
    },
  ],
})

jsonTester.run('settings-marketplace-skip-lfs (message text)', rule, {
  valid: [],
  invalid: [
    {
      code: json(entry({ ...github, skipLfs: true })),
      filename,
      errors: [
        {
          message:
            'Claude Code accepts "skipLfs" and ignores it from v2.1.274. It never downloads Git LFS content when it clones a marketplace. Remove the field.',
        },
      ],
    },
  ],
})
