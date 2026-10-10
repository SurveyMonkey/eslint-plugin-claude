// The rule reads `strictKnownMarketplaces` and its alias in the managed settings files. The files
// glob and the decoy files are in tests/configs.test.ts.
import { json5Tester, jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-known-marketplaces-pattern-anchored')
const filename = 'managed-settings.json'
const dropIn = 'managed-settings.d/10-a.json'
const json = JSON.stringify
const host = (hostPattern: unknown) => ({ source: 'hostPattern', hostPattern })
const path = (pathPattern: unknown) => ({ source: 'pathPattern', pathPattern })
const allow = (...entries: unknown[]) => json({ strictKnownMarketplaces: entries })

jsonTester.run('settings-known-marketplaces-pattern-anchored (valid)', rule, {
  valid: [
    // An anchored pattern, in each file.
    { code: allow(host('^github\\.example\\.com$')), filename },
    { code: allow(host('^github\\.example\\.com$')), filename: dropIn },
    { code: allow(path('^/opt/approved/')), filename },
    { code: allow(path('^/opt/approved/$')), filename },
    // An anchor for each alternative, and an escaped backslash before the closing anchor.
    { code: allow(host('^a\\.example$|^b\\.example$')), filename },
    { code: allow(host('^a\\\\$')), filename },
    { code: allow(host('^a\\\\\\\\$')), filename },
    { code: allow(host('^a|b$')), filename },
    // The docs show `".*"` as the pattern that allows every local path.
    { code: allow(path('.*')), filename },
    // The pattern does not compile: `settings-known-marketplaces-policy-schema` reports it.
    { code: allow(host('(')), filename },
    { code: allow(path('[')), filename },
    // A value that the policy schema rule reports.
    { code: allow(host(1), path(null), host(undefined), { source: 'hostPattern' }), filename },
    {
      code: allow('hostPattern', null, [host('x')], {}, { source: 1, hostPattern: 'x' }),
      filename,
    },
    // Another source type, with a field of the same name.
    {
      code: allow({ source: 'github', repo: 'a/b', hostPattern: 'x', pathPattern: 'x' }),
      filename,
    },
    {
      code: allow({ source: 'url', url: 'https://x.test/m.json' }, { source: 'skills-dir' }),
      filename,
    },
    { code: allow({ source: 'hostpattern', hostPattern: 'x' }), filename },
    // The blocklist: an unanchored pattern there blocks more, and widens nothing.
    { code: json({ blockedMarketplaces: [host('github.example.com'), path('/opt')] }), filename },
    // A value that is not a list, or no key.
    { code: json({ strictKnownMarketplaces: 'x' }), filename },
    { code: json({ strictKnownMarketplaces: null }), filename },
    { code: json({ strictKnownMarketplaces: host('x') }), filename },
    { code: json({ model: 'opus' }), filename },
    { code: '{}', filename },
    { code: '[]', filename },
    // The alias is ignored when the canonical key is set.
    {
      code: json({ strictKnownMarketplaces: [], allowedMarketplaces: [host('x')] }),
      filename,
    },
    // Claude Code ignores a hidden drop-in, so it reads no key there.
    { code: allow(host('x')), filename: 'managed-settings.d/.10-a.json' },
  ],
  invalid: [],
})

jsonTester.run('settings-known-marketplaces-pattern-anchored (invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: allow(host('github.example.com')),
      filename,
      errors: [
        {
          messageId: 'unanchored',
          data: {
            type: 'hostPattern',
            value: 'github.example.com',
            need: 'start with "^" and end with "$"',
            target: 'host',
          },
          line: 1,
          column: 67,
          endColumn: 87,
        },
      ],
    },
    {
      code: allow(host('github.example.com')),
      filename: dropIn,
      errors: [{ messageId: 'unanchored' }],
    },
    // One anchor is not enough for a host.
    {
      code: allow(host('^github\\.example\\.com')),
      filename,
      errors: [{ messageId: 'unanchored' }],
    },
    {
      code: allow(host('github\\.example\\.com$')),
      filename,
      errors: [{ messageId: 'unanchored' }],
    },
    // An escaped `$` is a literal dollar sign, and no anchor.
    { code: allow(host('^a\\$')), filename, errors: [{ messageId: 'unanchored' }] },
    { code: allow(host('^a\\\\\\$')), filename, errors: [{ messageId: 'unanchored' }] },
    { code: allow(host('^a$|b')), filename, errors: [{ messageId: 'unanchored' }] },
    { code: allow(host('')), filename, errors: [{ messageId: 'unanchored' }] },
    { code: allow(host('.*')), filename, errors: [{ messageId: 'unanchored' }] },
    // A path needs the start anchor only.
    {
      code: allow(path('/opt/approved/')),
      filename,
      errors: [
        {
          messageId: 'unanchored',
          data: {
            type: 'pathPattern',
            value: '/opt/approved/',
            need: 'start with "^"',
            target: 'path',
          },
        },
      ],
    },
    { code: allow(path('')), filename, errors: [{ messageId: 'unanchored' }] },
    { code: allow(path('.*/opt')), filename, errors: [{ messageId: 'unanchored' }] },
    // The alias, when the canonical key is not there.
    {
      code: json({ allowedMarketplaces: [host('x'), path('y')] }),
      filename,
      errors: [{ messageId: 'unanchored' }, { messageId: 'unanchored' }],
    },
    // One report for each pattern.
    {
      code: allow(host('a'), host('^b$'), path('c'), path('^d')),
      filename,
      errors: [
        {
          messageId: 'unanchored',
          data: {
            type: 'hostPattern',
            value: 'a',
            need: 'start with "^" and end with "$"',
            target: 'host',
          },
        },
        {
          messageId: 'unanchored',
          data: { type: 'pathPattern', value: 'c', need: 'start with "^"', target: 'path' },
        },
      ],
    },
    // Two members with one key: the last counts, as `JSON.parse` keeps the last.
    {
      code: `{"strictKnownMarketplaces": [${json(host('x'))}], "strictKnownMarketplaces": [${json(host('^y$'))}, ${json(path('z'))}]}`,
      filename,
      errors: [
        {
          messageId: 'unanchored',
          data: { type: 'pathPattern', value: 'z', need: 'start with "^"', target: 'path' },
        },
      ],
    },
  ],
})

json5Tester.run('settings-known-marketplaces-pattern-anchored (JSON5 invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: "{ strictKnownMarketplaces: [{ source: 'hostPattern', hostPattern: 'x' }] }",
      filename,
      errors: [{ messageId: 'unanchored' }],
    },
  ],
})

jsonTester.run('settings-known-marketplaces-pattern-anchored (message text)', rule, {
  valid: [],
  invalid: [
    {
      code: allow(host('x')),
      filename,
      errors: [
        {
          message:
            'The "hostPattern" pattern "x" must start with "^" and end with "$". Claude Code matches the pattern anywhere in the host, so this entry allows more than it appears to.',
        },
      ],
    },
    {
      code: allow(path('/opt')),
      filename,
      errors: [
        {
          message:
            'The "pathPattern" pattern "/opt" must start with "^". Claude Code matches the pattern anywhere in the path, so this entry allows more than it appears to.',
        },
      ],
    },
  ],
})
