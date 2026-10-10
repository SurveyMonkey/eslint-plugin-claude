// Four limits of the sandbox depend on the platform or on the Claude Code version:
// https://code.claude.com/docs/en/settings-reference#sandbox-path-prefixes
// https://code.claude.com/docs/en/settings-reference#sandbox-network-allowunixsockets
// https://code.claude.com/docs/en/settings-reference#sandbox-network-alloweddomains
// https://code.claude.com/docs/en/sandboxing#enforce-sandboxing-with-managed-settings
// The rule reports a part only when the option of that part is set. `lintJson` takes no options,
// so this file runs the rule with a `Linter` of its own.
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { repo } from '../agent-settings.test-support.ts'

const name = 'sandbox-platform-limits'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const MANAGED = 'managed-settings.json'
const DROP_IN = 'managed-settings.d/10-a.json'
const HIDDEN = 'managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]

function lint(text: string, options: unknown[], file = PROJECT, root = repo({})) {
  const absolute = path.join(root, file)
  return new Linter({ cwd: path.parse(absolute).root }).verify(
    text,
    [
      {
        files: ['**/*.json'],
        plugins: { json, claude: plugin },
        language: 'json/json',
        rules: { [`claude/${name}`]: ['error', ...options] },
      },
    ],
    { filename: absolute },
  )
}
const ids = (text: string, options: unknown[], file = PROJECT, root?: string) =>
  lint(text, options, file, root).map((message) => message.messageId)

const filesystem = (fields: object) => JSON.stringify({ sandbox: { filesystem: fields } })
const network = (fields: object) => JSON.stringify({ sandbox: { network: fields } })
const LINUX = [{ platforms: ['linux'] }]
const WSL = [{ platforms: ['wsl'] }]
const MAC = [{ platforms: ['macos'] }]
const WINDOWS = [{ platforms: ['windows-no-git-bash'] }]
const OLD = [{ minVersion: '2.1.200' }]

describe(`${name}: write lists on Linux and WSL2`, () => {
  it('reports a wildcard in allowWrite and denyWrite, in every file', () => {
    for (const file of EVERY_FILE) {
      for (const list of ['allowWrite', 'denyWrite']) {
        expect(ids(filesystem({ [list]: ['/tmp/*'] }), LINUX, file), `${list} ${file}`).toEqual([
          'writeWildcard',
        ])
      }
    }
  })

  it('reports for linux and for wsl, and not for macos or windows', () => {
    const text = filesystem({ allowWrite: ['/tmp/*'] })
    expect(ids(text, LINUX)).toEqual(['writeWildcard'])
    expect(ids(text, WSL)).toEqual(['writeWildcard'])
    expect(ids(text, [{ platforms: ['macos', 'linux'] }])).toEqual(['writeWildcard'])
    expect(ids(text, MAC)).toEqual([])
    expect(ids(text, WINDOWS)).toEqual([])
  })

  it('reads *, ? and [ after it removes a trailing /**', () => {
    for (const entry of ['/a/*.log', '/a/?', '/a/[bc]', '~/*/x', '/a/**/b', '/a/b/**/']) {
      expect(ids(filesystem({ allowWrite: [entry] }), LINUX), entry).toEqual(['writeWildcard'])
    }
    for (const entry of ['/a/b/**', '~/build/**', '/a/b', './out']) {
      expect(ids(filesystem({ allowWrite: [entry] }), LINUX), entry).toEqual([])
    }
  })

  it('reports each entry, at its line and column', () => {
    const text =
      '{\n  "sandbox": {\n    "filesystem": {\n      "allowWrite": ["/a", "/b/*"]\n    }\n  }\n}'
    const [message] = lint(text, LINUX)
    expect([message?.line, message?.column]).toEqual([4, 28])
  })

  it('is silent for denyRead and allowRead, where wildcards work on every platform', () => {
    expect(ids(filesystem({ denyRead: ['/a/*'], allowRead: ['/b/*'] }), LINUX)).toEqual([])
  })

  it('is silent with no option, and with an empty platforms list', () => {
    const text = filesystem({ allowWrite: ['/tmp/*'] })
    expect(ids(text, [])).toEqual([])
    expect(ids(text, [{}])).toEqual([])
    expect(ids(text, [{ platforms: [] }])).toEqual([])
  })

  it('does not read an entry that is not a string, or a list that is not an array', () => {
    expect(ids(filesystem({ allowWrite: [1, null], denyWrite: 'x' }), LINUX)).toEqual([])
  })
})

describe(`${name}: Edit rules on Linux and WSL2`, () => {
  const settings = (rules: object, sandbox: unknown = { enabled: true }) =>
    JSON.stringify({ permissions: rules, sandbox })

  it('reports an Edit allow and deny rule with a wildcard while the sandbox is on', () => {
    expect(ids(settings({ allow: ['Edit(/tmp/*)'] }), LINUX)).toEqual(['editWildcard'])
    expect(ids(settings({ deny: ['Edit(*.env)'] }), WSL)).toEqual(['editWildcard'])
  })

  it('reports in a managed file, and counts a quoted true there', () => {
    expect(ids(settings({ deny: ['Edit(*.env)'] }), LINUX, MANAGED)).toEqual(['editWildcard'])
    expect(ids(settings({ deny: ['Edit(*.env)'] }, { enabled: 'true' }), LINUX, MANAGED)).toEqual([
      'editWildcard',
    ])
    expect(ids(settings({ deny: ['Edit(*.env)'] }, { enabled: 'true' }), LINUX, PROJECT)).toEqual(
      [],
    )
  })

  it('reads a wildcard after it removes a trailing /**', () => {
    expect(ids(settings({ deny: ['Edit(src/**)', 'Edit(/a/b/**)'] }), LINUX)).toEqual([])
    expect(ids(settings({ deny: ['Edit(src/*/x)'] }), LINUX)).toEqual(['editWildcard'])
  })

  it('is silent when the sandbox is off or not set in this file', () => {
    expect(ids(settings({ deny: ['Edit(*.env)'] }, { enabled: false }), LINUX)).toEqual([])
    expect(ids(settings({ deny: ['Edit(*.env)'] }, {}), LINUX)).toEqual([])
    expect(ids(JSON.stringify({ permissions: { deny: ['Edit(*.env)'] } }), LINUX)).toEqual([])
  })

  it('is silent for ask, a bare Edit, another tool, and macOS', () => {
    expect(ids(settings({ ask: ['Edit(*.env)'] }), LINUX)).toEqual([])
    expect(ids(settings({ deny: ['Edit', 'Read(*.env)', 'Write(*.env)'] }), LINUX)).toEqual([])
    expect(ids(settings({ deny: ['Edit(*.env)'] }), MAC)).toEqual([])
  })

  it('skips an allow rule that a deny rule covers, which permissions-dead-allow reports', () => {
    expect(ids(settings({ allow: ['Edit(*.env)'], deny: ['Edit(*.env)'] }), LINUX)).toEqual([
      'editWildcard',
    ])
    expect(ids(settings({ allow: ['Edit(*.env)'], deny: ['Edit'] }), LINUX)).toEqual([])
    expect(ids(settings({ allow: ['Edit(*.env)'], deny: ['Edit(*.log)'] }), LINUX)).toEqual([
      'editWildcard',
      'editWildcard',
    ])
  })
})

describe(`${name}: allowUnixSockets on Linux and WSL2`, () => {
  it('reports a non-empty allowUnixSockets, once, at the key', () => {
    expect(ids(network({ allowUnixSockets: ['/a.sock', '/b.sock'] }), LINUX)).toEqual([
      'unixSockets',
    ])
    expect(ids(network({ allowUnixSockets: ['/a.sock'] }), WSL)).toEqual(['unixSockets'])
    const text =
      '{\n  "sandbox": {\n    "network": {\n      "allowUnixSockets": ["/a"]\n    }\n  }\n}'
    const [message] = lint(text, LINUX)
    expect([message?.line, message?.column]).toEqual([4, 7])
  })

  it('is silent on macOS, for an empty list, and for allowAllUnixSockets', () => {
    expect(ids(network({ allowUnixSockets: ['/a.sock'] }), MAC)).toEqual([])
    expect(ids(network({ allowUnixSockets: [] }), LINUX)).toEqual([])
    expect(ids(network({ allowAllUnixSockets: true }), LINUX)).toEqual([])
    expect(ids(network({ allowUnixSockets: 'x' }), LINUX)).toEqual([])
  })
})

describe(`${name}: trailing slash on a deny path before v2.1.224`, () => {
  it('reports a trailing slash in denyRead and denyWrite when minVersion is below 2.1.224', () => {
    for (const list of ['denyRead', 'denyWrite']) {
      expect(ids(filesystem({ [list]: ['~/.aws/'] }), OLD), list).toEqual(['trailingSlash'])
    }
    expect(ids(filesystem({ denyRead: ['~/.aws/'] }), [{ minVersion: '2.1.223' }])).toEqual([
      'trailingSlash',
    ])
  })

  it('reports in every file, and names the minVersion', () => {
    for (const file of EVERY_FILE) {
      expect(ids(filesystem({ denyRead: ['/a/'] }), OLD, file), file).toEqual(['trailingSlash'])
    }
    expect(lint(filesystem({ denyRead: ['/a/'] }), OLD)[0]?.message).toContain('2.1.200')
  })

  it('is silent when minVersion is 2.1.224 or later, and when it is unset', () => {
    const text = filesystem({ denyRead: ['~/.aws/'] })
    expect(ids(text, [{ minVersion: '2.1.224' }])).toEqual([])
    expect(ids(text, [{ minVersion: '2.2.0' }])).toEqual([])
    expect(ids(text, [{ minVersion: '3.0.0' }])).toEqual([])
    expect(ids(text, [{ minVersion: '2.1.1000' }])).toEqual([])
    expect(ids(text, [{}])).toEqual([])
  })

  it('is silent for a path with no trailing slash, and for the other path lists', () => {
    expect(
      ids(
        filesystem({ denyRead: ['~/.aws', '/a/**'], allowRead: ['/a/'], allowWrite: ['/b/'] }),
        OLD,
      ),
    ).toEqual([])
  })

  it('compares the three numbers of the version', () => {
    const text = filesystem({ denyRead: ['/a/'] })
    expect(ids(text, [{ minVersion: '1.9.9' }])).toEqual(['trailingSlash'])
    expect(ids(text, [{ minVersion: '2.0.999' }])).toEqual(['trailingSlash'])
    expect(ids(text, [{ minVersion: '2.1.9' }])).toEqual(['trailingSlash'])
    expect(ids(text, [{ minVersion: '2.1.99' }])).toEqual(['trailingSlash'])
  })
})

describe(`${name}: bracketed IPv6 before v2.1.229`, () => {
  it('reports a bracketed entry of either list when minVersion is below 2.1.229', () => {
    for (const list of ['allowedDomains', 'deniedDomains']) {
      expect(
        ids(network({ [list]: ['[::1]', '[::1]:443'] }), [{ minVersion: '2.1.228' }]),
        list,
      ).toEqual(['ipv6', 'ipv6'])
    }
  })

  it('reports a WebFetch rule with a bracketed domain, in allow and deny', () => {
    const rules = { allow: ['WebFetch(domain:[::1])'], deny: ['WebFetch(domain:[2001:db8::1])'] }
    expect(ids(JSON.stringify({ permissions: rules }), OLD)).toEqual(['ipv6', 'ipv6'])
  })

  it('reports in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids(network({ allowedDomains: ['[::1]'] }), OLD, file), file).toEqual(['ipv6'])
    }
  })

  it('is silent when minVersion is 2.1.229 or later, and when it is unset', () => {
    const text = network({ allowedDomains: ['[::1]'] })
    expect(ids(text, [{ minVersion: '2.1.229' }])).toEqual([])
    expect(ids(text, [{}])).toEqual([])
    expect(ids(text, [])).toEqual([])
  })

  it('is silent for a bracket that does not close or holds nothing', () => {
    expect(
      ids(network({ allowedDomains: ['[::1', '[]', '[]:443', '[::1]x', 'a[::1]'] }), OLD),
    ).toEqual([])
    expect(
      ids(
        JSON.stringify({
          permissions: { allow: ['WebFetch(domain:[::1)', 'WebFetch(domain:[])'] },
        }),
        OLD,
      ),
    ).toEqual([])
  })

  it('is silent for hostnames, IPv4 and an unbracketed entry', () => {
    expect(
      ids(network({ allowedDomains: ['a.com', '1.2.3.4', '::1', '*.a.com:443'] }), OLD),
    ).toEqual([])
    expect(
      ids(JSON.stringify({ permissions: { allow: ['WebFetch(domain:a.com)', 'Read'] } }), OLD),
    ).toEqual([])
  })

  it('does not read an entry that is not a string, or a list that is not an array', () => {
    expect(ids(network({ allowedDomains: [1, null], deniedDomains: '[::1]' }), OLD)).toEqual([])
  })
})

describe(`${name}: failIfUnavailable on native Windows`, () => {
  const fail = (value: unknown) => JSON.stringify({ sandbox: { failIfUnavailable: value } })

  it('reports true when platforms names a Windows platform, in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids(fail(true), WINDOWS, file), file).toEqual(['failIfUnavailable'])
    }
    expect(ids(fail(true), [{ platforms: ['windows-git-bash'] }])).toEqual(['failIfUnavailable'])
  })

  it('counts a quoted true in a managed file', () => {
    expect(ids(fail('true'), WINDOWS, MANAGED)).toEqual(['failIfUnavailable'])
    expect(ids(fail('true'), WINDOWS, PROJECT)).toEqual([])
  })

  it('is silent for false, other platforms, and no option', () => {
    expect(ids(fail(false), WINDOWS)).toEqual([])
    expect(ids(fail(true), MAC)).toEqual([])
    expect(ids(fail(true), LINUX)).toEqual([])
    expect(ids(fail(true), WSL)).toEqual([])
    expect(ids(fail(true), [])).toEqual([])
  })
})

describe(`${name}: the parts together`, () => {
  it('reports each part that its option turns on', () => {
    const text = JSON.stringify({
      sandbox: {
        failIfUnavailable: true,
        filesystem: { allowWrite: ['/tmp/*'], denyRead: ['/a/'] },
        network: { allowUnixSockets: ['/a'], allowedDomains: ['[::1]'] },
      },
    })
    const all = [{ platforms: ['linux', 'windows-no-git-bash'], minVersion: '2.1.100' }]
    expect(ids(text, all).sort()).toEqual(
      ['failIfUnavailable', 'ipv6', 'trailingSlash', 'unixSockets', 'writeWildcard'].sort(),
    )
    expect(ids(text, [{ platforms: ['macos'] }])).toEqual([])
  })

  it('is silent in a hidden drop-in', () => {
    expect(ids(filesystem({ allowWrite: ['/a/*'] }), LINUX, HIDDEN)).toEqual([])
  })

  it('is silent for a root that is not an object', () => {
    expect(ids('[1]', LINUX)).toEqual([])
  })

  it('refuses an unknown platform and a bad version', () => {
    expect(() => lint('{}', [{ platforms: ['plan9'] }])).toThrow('allowed values')
    expect(() => lint('{}', [{ minVersion: '2.1' }])).toThrow('pattern')
  })
})
