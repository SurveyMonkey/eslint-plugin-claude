// The rule reads `extraKnownMarketplaces` of `.claude/settings.json`. The files glob and the decoy
// files are in tests/configs.test.ts.
import { json5Tester, jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-extra-known-marketplaces-directory')
const filename = '.claude/settings.json'
const json = JSON.stringify
const entry = (source: unknown) => ({ extraKnownMarketplaces: { acme: { source } } })
const directory = (path: unknown) => ({ source: 'directory', path })

jsonTester.run('settings-extra-known-marketplaces-directory (valid)', rule, {
  valid: [
    // A relative path resolves against the repository, as the docs describe for a repository.
    { code: json(entry(directory('./tools/marketplace'))), filename },
    { code: json(entry(directory('tools/marketplace'))), filename },
    { code: json(entry(directory('../shared/marketplace'))), filename },
    { code: json(entry(directory('.'))), filename },
    // Another source type, with an absolute path or not.
    { code: json(entry({ source: 'github', repo: 'acme-corp/claude-plugins' })), filename },
    { code: json(entry({ source: 'git', url: 'https://git.test/p.git' })), filename },
    { code: json(entry({ source: 'file', path: '/opt/m/marketplace.json' })), filename },
    { code: json(entry({ source: 'url', url: 'https://x.test/marketplace.json' })), filename },
    { code: json(entry({ source: 'Directory', path: '/opt/m' })), filename },
    // A value that the schema rule reports.
    { code: json(entry(directory(1))), filename },
    { code: json(entry(directory(null))), filename },
    { code: json(entry({ source: 'directory' })), filename },
    { code: json(entry({ source: 1, path: '/opt/m' })), filename },
    { code: json(entry('directory')), filename },
    { code: json(entry(null)), filename },
    { code: json({ extraKnownMarketplaces: { acme: null } }), filename },
    { code: json({ extraKnownMarketplaces: { acme: 'x' } }), filename },
    { code: json({ extraKnownMarketplaces: ['x'] }), filename },
    { code: json({ extraKnownMarketplaces: null }), filename },
    { code: '{}', filename },
    { code: '[]', filename },
    // The alias is ignored when the canonical key is set.
    {
      code: json({
        extraKnownMarketplaces: {},
        additionalMarketplaces: entry(directory('/opt/m')),
      }),
      filename,
    },
    // Only the entry of the last member of a key counts.
    {
      code: `{"extraKnownMarketplaces": {"acme": ${json({ source: directory('/opt/m') })}, "acme": ${json({ source: directory('./m') })}}}`,
      filename,
    },
    // The policy lists are for `settings-known-marketplaces-policy-schema`.
    { code: json({ strictKnownMarketplaces: [directory('/opt/m')] }), filename },
  ],
  invalid: [],
})

jsonTester.run('settings-extra-known-marketplaces-directory (invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: json(entry(directory('/opt/marketplace'))),
      filename,
      errors: [
        {
          messageId: 'directory',
          data: { path: '/opt/marketplace' },
          line: 1,
          column: 74,
          endColumn: 92,
        },
      ],
    },
    // A Windows path, and a path that starts with a slash.
    {
      code: json(entry(directory('C:\\marketplaces\\acme'))),
      filename,
      errors: [{ messageId: 'directory' }],
    },
    {
      code: json(entry(directory('/'))),
      filename,
      errors: [{ messageId: 'directory' }],
    },
    // The alias, when the canonical key is not there.
    {
      code: json({ additionalMarketplaces: entry(directory('/opt/m')).extraKnownMarketplaces }),
      filename,
      errors: [{ messageId: 'directory' }],
    },
    // One report for each entry.
    {
      code: json({
        extraKnownMarketplaces: {
          a: { source: directory('/opt/a') },
          b: { source: directory('./b') },
          c: { source: directory('/opt/c') },
        },
      }),
      filename,
      errors: [
        { messageId: 'directory', data: { path: '/opt/a' } },
        { messageId: 'directory', data: { path: '/opt/c' } },
      ],
    },
    // Two members of one key: the last counts, as `JSON.parse` keeps the last.
    {
      code: `{"extraKnownMarketplaces": {"acme": ${json({ source: directory('./m') })}, "acme": ${json({ source: directory('/opt/m') })}}}`,
      filename,
      errors: [{ messageId: 'directory', data: { path: '/opt/m' } }],
    },
  ],
})

json5Tester.run('settings-extra-known-marketplaces-directory (JSON5 invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: "{ extraKnownMarketplaces: { acme: { source: { source: 'directory', path: '/opt/m' } } } }",
      filename,
      errors: [{ messageId: 'directory' }],
    },
  ],
})

jsonTester.run('settings-extra-known-marketplaces-directory (message text)', rule, {
  valid: [],
  invalid: [
    {
      code: json(entry(directory('/opt/m'))),
      filename,
      errors: [
        {
          message:
            'This "directory" source names the absolute path "/opt/m", which exists on one machine. The docs name "directory" for development. Use a path relative to the repository, or a "github" or "git" source.',
        },
      ],
    },
  ],
})
