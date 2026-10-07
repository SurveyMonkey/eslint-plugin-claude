// The rule reads the object `source` of each entry in `plugins` in
// `.claude-plugin/marketplace.json`. The files glob and the decoy files are in
// tests/configs.test.ts.
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import sourceSchema from '../../src/rules/marketplace-source-schema.ts'
import { json5Tester, jsonTester } from '../rule-tester.test-support.ts'

const { rule } = sourceSchema
const filename = '.claude-plugin/marketplace.json'
const manifest = (...plugins: unknown[]) => JSON.stringify({ name: 'acme', plugins })
const withSource = (source: unknown) => manifest({ name: 'p', source })
const sha = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0'
const sha256 = '6bfa50e3d2e00c052b46abe51fff89346ac803e45771f76dcf6df1ab74cca5e1'
const types = 'github, url, git-subdir, npm, archive, command'
const text = (length: number) => 'a'.repeat(length)
const command = (value: unknown) => withSource({ source: 'command', command: value })
const archive = (url: unknown) => withSource({ source: 'archive', url })

jsonTester.run('marketplace-source-schema (valid)', rule, {
  valid: [
    { code: withSource({ source: 'github', repo: 'your-org/formatter' }), filename },
    { code: withSource({ source: 'github', repo: 'o/r', ref: 'v2.0.0', sha }), filename },
    // The docs say that a `github` plugin source has no `path`, but give no error for it.
    { code: withSource({ source: 'github', repo: 'o/r', path: 'sub' }), filename },
    { code: withSource({ source: 'url', url: 'https://gitlab.example.com/g/f.git' }), filename },
    { code: withSource({ source: 'url', url: 'http://git.example.com/f' }), filename },
    { code: withSource({ source: 'url', url: 'file:///srv/git/f' }), filename },
    {
      code: withSource({ source: 'url', url: 'git@github.com:o/r.git', ref: 'main', sha }),
      filename,
    },
    { code: withSource({ source: 'url', url: 'HTTPS://example.com/f' }), filename },
    {
      code: withSource({ source: 'git-subdir', url: 'https://github.com/o/m.git', path: 't/f' }),
      filename,
    },
    { code: withSource({ source: 'git-subdir', url: 'o/m', path: 't', ref: 'v1', sha }), filename },
    // The docs name the full git URL of `git-subdir` and give no scheme list for it.
    { code: withSource({ source: 'git-subdir', url: 'ssh://git@h/m.git', path: 't' }), filename },
    { code: withSource({ source: 'npm', package: '@your-org/formatter' }), filename },
    {
      code: withSource({
        source: 'npm',
        package: '@o/f@2.0.0',
        version: '^2',
        registry: 'https://r.test',
      }),
      filename,
    },
    { code: withSource({ source: 'npm', package: 'https://r.test/f-1.0.0.tgz' }), filename },
    {
      code: withSource({ source: 'archive', url: 'https://artifacts.example.com/f.zip' }),
      filename,
    },
    { code: withSource({ source: 'archive', url: 'https://x.test/f.zip', sha256 }), filename },
    {
      code: withSource({
        source: 'archive',
        url: 'https://x.test/f.zip',
        sha256: sha256.toUpperCase(),
      }),
      filename,
    },
    { code: command('my-tool claude-plugin-path'), filename },
    { code: withSource({ source: 'command', command: 'c', timeout: 1, mode: 'copy' }), filename },
    { code: withSource({ source: 'command', command: 'c', timeout: 600, mode: 'link' }), filename },
    { code: withSource({ source: 'command', command: 'c', timeout: 60 }), filename },
    // 500 characters is the limit, and the limit is inclusive.
    { code: command(text(500)), filename },
    // Three spaces are not a run of four.
    { code: command('my-tool   path'), filename },
    // The rule does not check a relative path in a command.
    { code: command('./my-tool'), filename },
    // The printable range ends at `~` (0x7e).
    { code: command('my~tool'), filename },
    // A one-character command is valid at the smallest `max`.
    { code: command('x'), filename, options: [{ max: 1 }] },
    // The scheme of an archive URL has any letter case, as for a `url` source.
    { code: archive('HTTPS://x.test/f.zip'), filename },
    // A host that only starts like a barred one is not barred.
    { code: archive('https://127.0.0.1.example.com/f.zip'), filename },
    { code: archive('https://169.254.1.1.example.com/f.zip'), filename },
    { code: archive('https://[fec0::1]/f.zip'), filename },
    // Only an `archive` source has a host check. A `url` source may name a local host.
    { code: withSource({ source: 'url', url: 'https://localhost/r.git' }), filename },
    {
      code: withSource({ source: 'git-subdir', url: 'https://localhost/r.git', path: 't' }),
      filename,
    },
    // `max` moves the limit down, and 500 stays valid at `max: 500`.
    { code: command(text(100)), filename, options: [{ max: 100 }] },
    { code: command(text(500)), filename, options: [{ max: 500 }] },
    // A host that only looks like a blocked one, and a host in another form.
    { code: archive('https://127.example.com/f.zip'), filename },
    { code: archive('https://localhostess.example.com/f.zip'), filename },
    { code: archive('https://169.253.1.1/f.zip'), filename },
    { code: archive('https://[2001:db8::1]/f.zip'), filename },
    { code: archive('https://128.0.0.1:8443/f.zip'), filename },
    // A value that the URL parser refuses has no host to check.
    { code: archive('https://'), filename },
    // A key that the docs do not list is no fault.
    { code: withSource({ source: 'github', repo: 'o/r', extra: 1 }), filename },
    // `timeout` and `mode` are for a `command` source only.
    { code: withSource({ source: 'github', repo: 'o/r', timeout: 0, mode: 'x' }), filename },
    // A string source is for `marketplace-relative-source-format`.
    { code: withSource('./p'), filename },
    { code: withSource('../p'), filename },
    // A value of the wrong type is for `marketplace-schema`.
    { code: withSource(5), filename },
    { code: withSource(null), filename },
    { code: withSource(['github']), filename },
    { code: withSource(true), filename },
    { code: manifest({ name: 'p' }), filename },
    { code: manifest('p', null, 3), filename },
    { code: JSON.stringify({ name: 'acme', plugins: 'p' }), filename },
    { code: '[]', filename },
    // Two `source` keys. The rule reads the last, as `JSON.parse` does.
    {
      code: '{"plugins": [{"source": {"source": "git"}, "source": {"source": "npm", "package": "p"}}]}',
      filename,
    },
    // Two `source` keys inside the source object, and two of a field.
    {
      code: '{"plugins": [{"source": {"source": "git", "source": "npm", "package": "..", "package": "p"}}]}',
      filename,
    },
  ],
  invalid: [],
})

jsonTester.run('marketplace-source-schema (invalid)', rule, {
  valid: [],
  invalid: [
    // The type.
    {
      code: withSource({ repo: 'o/r' }),
      filename,
      errors: [{ messageId: 'typeMissing', data: { types }, line: 1, column: 48, endColumn: 62 }],
    },
    {
      code: withSource({ source: 5 }),
      filename,
      errors: [{ messageId: 'typeNotString', data: { types } }],
    },
    {
      code: withSource({ source: null }),
      filename,
      errors: [{ messageId: 'typeNotString', data: { types } }],
    },
    {
      code: withSource({ source: 'git', url: 'https://x.test/r.git' }),
      filename,
      errors: [
        {
          messageId: 'typeUnknown',
          data: { type: 'git', types },
          line: 1,
          column: 58,
          endColumn: 63,
        },
      ],
    },
    {
      code: withSource({ source: 'GitHub', repo: 'o/r' }),
      filename,
      errors: [{ messageId: 'typeUnknown', data: { type: 'GitHub', types } }],
    },
    {
      code: withSource({ source: '' }),
      filename,
      errors: [{ messageId: 'typeUnknown', data: { type: '', types } }],
    },
    {
      code: withSource({ source: 'file', path: '/x' }),
      filename,
      errors: [{ messageId: 'typeUnknown', data: { type: 'file', types } }],
    },
    {
      code: withSource({ source: 'unsupported' }),
      filename,
      errors: [{ messageId: 'typeUnsupported', data: { types } }],
    },
    // A required field that is missing, on the source object.
    {
      code: withSource({ source: 'github' }),
      filename,
      errors: [{ messageId: 'missingField', data: { type: 'github', field: 'repo' } }],
    },
    {
      code: withSource({ source: 'url' }),
      filename,
      errors: [{ messageId: 'missingField', data: { type: 'url', field: 'url' } }],
    },
    {
      code: withSource({ source: 'git-subdir' }),
      filename,
      errors: [
        { messageId: 'missingField', data: { type: 'git-subdir', field: 'url' } },
        { messageId: 'missingField', data: { type: 'git-subdir', field: 'path' } },
      ],
    },
    {
      code: withSource({ source: 'git-subdir', url: 'o/m' }),
      filename,
      errors: [{ messageId: 'missingField', data: { type: 'git-subdir', field: 'path' } }],
    },
    {
      code: withSource({ source: 'npm' }),
      filename,
      errors: [{ messageId: 'missingField', data: { type: 'npm', field: 'package' } }],
    },
    {
      code: withSource({ source: 'archive', sha256 }),
      filename,
      errors: [{ messageId: 'missingField', data: { type: 'archive', field: 'url' } }],
    },
    {
      code: withSource({ source: 'command', timeout: 5 }),
      filename,
      errors: [{ messageId: 'missingField', data: { type: 'command', field: 'command' } }],
    },
    // A field of the wrong type.
    {
      code: withSource({ source: 'github', repo: 5 }),
      filename,
      errors: [{ messageId: 'notString', data: { type: 'github', field: 'repo' } }],
    },
    {
      code: withSource({ source: 'github', repo: 'o/r', ref: 1 }),
      filename,
      errors: [{ messageId: 'notString', data: { type: 'github', field: 'ref' } }],
    },
    {
      code: withSource({ source: 'github', repo: 'o/r', sha: 1 }),
      filename,
      errors: [{ messageId: 'notString', data: { type: 'github', field: 'sha' } }],
    },
    {
      code: withSource({ source: 'url', url: ['https://x.test'] }),
      filename,
      errors: [{ messageId: 'notString', data: { type: 'url', field: 'url' } }],
    },
    {
      code: withSource({ source: 'git-subdir', url: 'o/m', path: null }),
      filename,
      errors: [{ messageId: 'notString', data: { type: 'git-subdir', field: 'path' } }],
    },
    {
      code: withSource({ source: 'npm', package: {} }),
      filename,
      errors: [{ messageId: 'notString', data: { type: 'npm', field: 'package' } }],
    },
    {
      code: withSource({ source: 'npm', package: 'p', version: 2 }),
      filename,
      errors: [{ messageId: 'notString', data: { type: 'npm', field: 'version' } }],
    },
    {
      code: withSource({ source: 'npm', package: 'p', registry: true }),
      filename,
      errors: [{ messageId: 'notString', data: { type: 'npm', field: 'registry' } }],
    },
    {
      code: withSource({ source: 'archive', url: 'https://x.test/f.zip', sha256: 5 }),
      filename,
      errors: [{ messageId: 'notString', data: { type: 'archive', field: 'sha256' } }],
    },
    {
      code: command(5),
      filename,
      errors: [{ messageId: 'notString', data: { type: 'command', field: 'command' } }],
    },
    // `github` `repo`.
    {
      code: withSource({ source: 'github', repo: 'formatter' }),
      filename,
      errors: [{ messageId: 'repoFormat', data: { value: 'formatter' } }],
    },
    {
      code: withSource({ source: 'github', repo: 'a/b/c' }),
      filename,
      errors: [{ messageId: 'repoFormat', data: { value: 'a/b/c' } }],
    },
    {
      code: withSource({ source: 'github', repo: 'o/' }),
      filename,
      errors: [{ messageId: 'repoFormat', data: { value: 'o/' } }],
    },
    {
      code: withSource({ source: 'github', repo: '/r' }),
      filename,
      errors: [{ messageId: 'repoFormat', data: { value: '/r' } }],
    },
    {
      code: withSource({ source: 'github', repo: 'o /r' }),
      filename,
      errors: [{ messageId: 'repoFormat', data: { value: 'o /r' } }],
    },
    {
      code: withSource({ source: 'github', repo: 'https://github.com/o/r' }),
      filename,
      errors: [{ messageId: 'repoFormat', data: { value: 'https://github.com/o/r' } }],
    },
    {
      code: withSource({ source: 'github', repo: '' }),
      filename,
      errors: [{ messageId: 'repoFormat', data: { value: '' } }],
    },
    // `url` `url`.
    {
      code: withSource({ source: 'url', url: 'o/r' }),
      filename,
      errors: [{ messageId: 'urlScheme' }],
    },
    {
      code: withSource({ source: 'url', url: 'ssh://git@h/r.git' }),
      filename,
      errors: [{ messageId: 'urlScheme' }],
    },
    {
      code: withSource({ source: 'url', url: ' https://x.test/r' }),
      filename,
      errors: [{ messageId: 'urlScheme' }],
    },
    // `sha`.
    {
      code: withSource({ source: 'github', repo: 'o/r', sha: sha.toUpperCase() }),
      filename,
      errors: [{ messageId: 'shaFormat', data: { type: 'github' } }],
    },
    {
      code: withSource({ source: 'url', url: 'https://x.test/r', sha: sha.slice(0, 7) }),
      filename,
      errors: [{ messageId: 'shaFormat', data: { type: 'url' } }],
    },
    {
      code: withSource({ source: 'git-subdir', url: 'o/m', path: 't', sha: `${sha}0` }),
      filename,
      errors: [{ messageId: 'shaFormat', data: { type: 'git-subdir' } }],
    },
    {
      code: withSource({ source: 'github', repo: 'o/r', sha: `${sha.slice(1)}g` }),
      filename,
      errors: [{ messageId: 'shaFormat', data: { type: 'github' } }],
    },
    {
      code: withSource({ source: 'github', repo: 'o/r', sha: '' }),
      filename,
      errors: [{ messageId: 'shaFormat', data: { type: 'github' } }],
    },
    // `npm` `package`.
    {
      code: withSource({ source: 'npm', package: '../p' }),
      filename,
      errors: [{ messageId: 'npmParent' }],
    },
    {
      code: withSource({ source: 'npm', package: '@o/..' }),
      filename,
      errors: [{ messageId: 'npmParent' }],
    },
    // `archive` `url`.
    { code: archive('http://x.test/f.zip'), filename, errors: [{ messageId: 'archiveScheme' }] },
    { code: archive('git@x.test:f.zip'), filename, errors: [{ messageId: 'archiveScheme' }] },
    { code: archive(''), filename, errors: [{ messageId: 'archiveScheme' }] },
    {
      code: archive('https://localhost/f.zip'),
      filename,
      errors: [{ messageId: 'archiveHost', data: { host: 'localhost', kind: 'loopback' } }],
    },
    {
      code: archive('https://LocalHost.:8080/f.zip'),
      filename,
      errors: [{ messageId: 'archiveHost', data: { host: 'localhost', kind: 'loopback' } }],
    },
    {
      code: archive('https://app.localhost/f.zip'),
      filename,
      errors: [{ messageId: 'archiveHost', data: { host: 'app.localhost', kind: 'loopback' } }],
    },
    {
      code: archive('https://127.0.0.1/f.zip'),
      filename,
      errors: [{ messageId: 'archiveHost', data: { host: '127.0.0.1', kind: 'loopback' } }],
    },
    {
      code: archive('https://127.1.2.3:8443/f.zip'),
      filename,
      errors: [{ messageId: 'archiveHost', data: { host: '127.1.2.3', kind: 'loopback' } }],
    },
    {
      code: archive('https://2130706433/f.zip'),
      filename,
      errors: [{ messageId: 'archiveHost', data: { host: '127.0.0.1', kind: 'loopback' } }],
    },
    {
      code: archive('https://[::1]/f.zip'),
      filename,
      errors: [{ messageId: 'archiveHost', data: { host: '[::1]', kind: 'loopback' } }],
    },
    {
      code: archive('https://169.254.10.20/f.zip'),
      filename,
      errors: [{ messageId: 'archiveHost', data: { host: '169.254.10.20', kind: 'link-local' } }],
    },
    {
      code: archive('https://169.254.200.1/f.zip'),
      filename,
      errors: [{ messageId: 'archiveHost', data: { host: '169.254.200.1', kind: 'link-local' } }],
    },
    {
      code: archive('https://127.200.200.200/f.zip'),
      filename,
      errors: [{ messageId: 'archiveHost', data: { host: '127.200.200.200', kind: 'loopback' } }],
    },
    {
      code: archive('https://[fe80::1]/f.zip'),
      filename,
      errors: [{ messageId: 'archiveHost', data: { host: '[fe80::1]', kind: 'link-local' } }],
    },
    {
      code: archive('https://169.254.169.254/latest/meta-data'),
      filename,
      errors: [
        { messageId: 'archiveHost', data: { host: '169.254.169.254', kind: 'cloud-metadata' } },
      ],
    },
    {
      code: archive('https://metadata.google.internal/x'),
      filename,
      errors: [
        {
          messageId: 'archiveHost',
          data: { host: 'metadata.google.internal', kind: 'cloud-metadata' },
        },
      ],
    },
    {
      code: archive('https://100.100.100.200/x'),
      filename,
      errors: [
        { messageId: 'archiveHost', data: { host: '100.100.100.200', kind: 'cloud-metadata' } },
      ],
    },
    {
      code: archive('https://[fd00:ec2::254]/x'),
      filename,
      errors: [
        { messageId: 'archiveHost', data: { host: '[fd00:ec2::254]', kind: 'cloud-metadata' } },
      ],
    },
    // The IPv6 link-local range is fe80 to febf.
    ...['[febf::1]', '[fe90::1]', '[fea0::1]'].map((host) => ({
      code: archive(`https://${host}/f.zip`),
      filename,
      errors: [{ messageId: 'archiveHost' as const, data: { host, kind: 'link-local' } }],
    })),
    // A `sha` of 39 characters, and a `sha256` of 63.
    {
      code: withSource({ source: 'github', repo: 'o/r', sha: sha.slice(1) }),
      filename,
      errors: [{ messageId: 'shaFormat' }],
    },
    {
      code: withSource({ source: 'archive', url: 'https://x.test/f.zip', sha256: sha256.slice(1) }),
      filename,
      errors: [{ messageId: 'sha256Format' }],
    },
    // The optional fields of a `url` and a `git-subdir` source are strings.
    {
      code: withSource({ source: 'url', url: 'https://x.test/r.git', ref: 1 }),
      filename,
      errors: [{ messageId: 'notString', data: { type: 'url', field: 'ref' } }],
    },
    {
      code: withSource({ source: 'git-subdir', url: 'o/m', path: 't', ref: 1 }),
      filename,
      errors: [{ messageId: 'notString', data: { type: 'git-subdir', field: 'ref' } }],
    },
    // A control character below the space is not printable.
    { code: command('my\u001ftool'), filename, errors: [{ messageId: 'commandNotPrintable' }] },
    // `archive` `sha256`.
    {
      code: withSource({ source: 'archive', url: 'https://x.test/f.zip', sha256: sha }),
      filename,
      errors: [{ messageId: 'sha256Format' }],
    },
    {
      code: withSource({ source: 'archive', url: 'https://x.test/f.zip', sha256: `${sha256}0` }),
      filename,
      errors: [{ messageId: 'sha256Format' }],
    },
    {
      code: withSource({
        source: 'archive',
        url: 'https://x.test/f.zip',
        sha256: `${sha256.slice(1)}g`,
      }),
      filename,
      errors: [{ messageId: 'sha256Format' }],
    },
    // `command` `command`.
    { code: command('my-tool é'), filename, errors: [{ messageId: 'commandNotPrintable' }] },
    { code: command('my\ttool'), filename, errors: [{ messageId: 'commandNotPrintable' }] },
    { code: command('my\u007ftool'), filename, errors: [{ messageId: 'commandNotPrintable' }] },
    {
      code: command(text(501)),
      filename,
      errors: [{ messageId: 'commandTooLong', data: { length: '501', max: '500' } }],
    },
    // At another value, the message names the configured limit.
    {
      code: command(text(101)),
      filename,
      options: [{ max: 100 }],
      errors: [{ messageId: 'commandOverConfiguredLimit', data: { length: '101', max: '100' } }],
    },
    {
      code: command(text(501)),
      filename,
      options: [{ max: 500 }],
      errors: [{ messageId: 'commandTooLong', data: { length: '501', max: '500' } }],
    },
    { code: command('my-tool    path'), filename, errors: [{ messageId: 'commandSpaceRun' }] },
    // Each fault of the command is its own report, in the order of the messages.
    {
      code: command(`é    ${text(500)}`),
      filename,
      errors: [
        { messageId: 'commandNotPrintable' },
        { messageId: 'commandTooLong', data: { length: '505', max: '500' } },
        { messageId: 'commandSpaceRun' },
      ],
    },
    // `command` `timeout`.
    {
      code: withSource({ source: 'command', command: 'c', timeout: 0 }),
      filename,
      errors: [{ messageId: 'timeout' }],
    },
    {
      code: withSource({ source: 'command', command: 'c', timeout: 601 }),
      filename,
      errors: [{ messageId: 'timeout' }],
    },
    {
      code: withSource({ source: 'command', command: 'c', timeout: -5 }),
      filename,
      errors: [{ messageId: 'timeout' }],
    },
    {
      code: withSource({ source: 'command', command: 'c', timeout: 1.5 }),
      filename,
      errors: [{ messageId: 'timeout' }],
    },
    {
      code: withSource({ source: 'command', command: 'c', timeout: '60' }),
      filename,
      errors: [{ messageId: 'timeout' }],
    },
    {
      code: withSource({ source: 'command', command: 'c', timeout: null }),
      filename,
      errors: [{ messageId: 'timeout' }],
    },
    // `command` `mode`.
    {
      code: withSource({ source: 'command', command: 'c', mode: 'move' }),
      filename,
      errors: [{ messageId: 'mode' }],
    },
    {
      code: withSource({ source: 'command', command: 'c', mode: 'Copy' }),
      filename,
      errors: [{ messageId: 'mode' }],
    },
    {
      code: withSource({ source: 'command', command: 'c', mode: 1 }),
      filename,
      errors: [{ messageId: 'mode' }],
    },
    // Each entry reports on its own source, and one source reports each fault.
    {
      code: manifest(
        { name: 'a', source: { source: 'github', repo: 'x' } },
        { name: 'b', source: { source: 'npm', package: 'ok' } },
        { name: 'c', source: { source: 'url', url: 'x', sha: 'y' } },
      ),
      filename,
      errors: [
        { messageId: 'repoFormat', data: { value: 'x' } },
        { messageId: 'urlScheme' },
        { messageId: 'shaFormat', data: { type: 'url' } },
      ],
    },
    // Two `source` keys. `JSON.parse` keeps the last.
    {
      code: '{"plugins": [{"source": {"source": "npm", "package": "p"}, "source": {"source": "git"}}]}',
      filename,
      errors: [{ messageId: 'typeUnknown', data: { type: 'git', types } }],
    },
    // Two keys inside the source object. The rule reads the last of each.
    {
      code: '{"plugins": [{"source": {"source": "npm", "source": "git", "package": "p"}}]}',
      filename,
      errors: [{ messageId: 'typeUnknown', data: { type: 'git', types } }],
    },
    {
      code: '{"plugins": [{"source": {"source": "npm", "package": "p", "package": ".."}}]}',
      filename,
      errors: [{ messageId: 'npmParent' }],
    },
  ],
})

// JSON5 allows a bare key, a single-quoted string, and `Infinity` and `NaN`. The rule reads
// each key and value in the same way.
json5Tester.run('marketplace-source-schema (JSON5 valid)', rule, {
  valid: [
    { code: "{ plugins: [{ source: { source: 'github', repo: 'o/r' } }] }" },
    { code: "{ plugins: [{ source: { source: 'command', command: 'c', timeout: 0x10 } }] }" },
  ],
  invalid: [],
})

json5Tester.run('marketplace-source-schema (JSON5 invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: "{ plugins: [{ source: { source: 'github', repo: 'x' } }] }",
      errors: [{ messageId: 'repoFormat', data: { value: 'x' } }],
    },
    {
      code: "{ plugins: [{ source: { source: 'command', command: 'c', timeout: Infinity } }] }",
      errors: [{ messageId: 'timeout' }],
    },
    {
      code: "{ plugins: [{ source: { source: 'command', command: 'c', timeout: NaN } }] }",
      errors: [{ messageId: 'timeout' }],
    },
    {
      code: "{ plugins: [{ source: { 'source': 'command', command: 'c', timeout: 0 } }] }",
      errors: [{ messageId: 'timeout' }],
    },
  ],
})

describe('marketplace-source-schema options', () => {
  // The rule alone, so that the test does not depend on the plugin list.
  const plugin = { rules: { [sourceSchema.name]: rule } }
  const lint = (length: number, options: unknown[]) =>
    new Linter({ cwd: '/' }).verify(
      command(text(length)),
      [
        {
          files: ['**/*.json'],
          plugins: { json, markdown, claude: plugin },
          language: 'json/json',
          rules: { 'claude/marketplace-source-schema': ['error', ...options] as never },
        },
      ],
      { filename: '/repo/.claude-plugin/marketplace.json' },
    )

  it('names a team value as the configured limit and not as the docs limit', () => {
    const [report] = lint(150, [{ max: 100 }])
    expect(report?.message).toBe(
      'The "command" of a "command" source has 150 characters. The configured limit is 100.',
    )
  })

  it('keeps the default when the option object is empty', () => {
    const [report] = lint(501, [{}])
    expect(report?.message).toBe(
      'The "command" of a "command" source has 501 characters. The docs allow at most 500.',
    )
  })

  it.each([
    ['zero', { max: 0 }],
    ['a fraction', { max: 1.5 }],
    ['a string', { max: '100' }],
    ['a value above 500', { max: 501 }],
    ['an unknown key', { max: 100, extra: 1 }],
  ])('refuses %s as the option', (_, option) => {
    expect(() => lint(10, [option])).toThrow(/Key "claude\/marketplace-source-schema"/)
  })
})

// Each report sits on the value that has the fault. The expected column is the
// place of the value text in the one-line JSON.
const located: [string, unknown, string][] = [
  ['repoFormat', { source: 'github', repo: 'x' }, '"x"'],
  ['urlScheme', { source: 'url', url: 'ftp://x' }, '"ftp://x"'],
  ['archiveScheme', { source: 'archive', url: 'http://x.test/f' }, '"http://x.test/f"'],
  ['archiveHost', { source: 'archive', url: 'https://localhost/f' }, '"https://localhost/f"'],
  ['shaFormat', { source: 'github', repo: 'o/r', sha: 'abc' }, '"abc"'],
  ['npmParent', { source: 'npm', package: '../x' }, '"../x"'],
  ['sha256Format', { source: 'archive', url: 'https://x.test/f', sha256: 'abc' }, '"abc"'],
  ['commandNotPrintable', { source: 'command', command: 'a\tb' }, '"a\\tb"'],
  ['commandSpaceRun', { source: 'command', command: 'a     b' }, '"a     b"'],
  ['commandTooLong', { source: 'command', command: 'a'.repeat(501) }, `"${'a'.repeat(501)}"`],
  ['timeout', { source: 'command', command: 'x', timeout: 0 }, '0'],
  ['mode', { source: 'command', command: 'x', mode: 'move' }, '"move"'],
  ['notString', { source: 'npm', package: 5 }, '5'],
]

jsonTester.run('marketplace-source-schema (location)', rule, {
  valid: [],
  invalid: located.map(([messageId, source, needle]) => {
    const code = withSource(source)
    const column = code.indexOf(needle) + 1
    return {
      code,
      filename,
      errors: [
        {
          messageId: messageId as 'repoFormat',
          line: 1,
          column,
          endLine: 1,
          endColumn: column + needle.length,
        },
      ],
    }
  }),
})
