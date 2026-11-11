// Seven limits of the sandbox depend on the platform or on the Claude Code version:
// https://code.claude.com/docs/en/settings-reference#sandbox-path-prefixes
// https://code.claude.com/docs/en/settings-reference#where-wildcards-work-in-sandbox-paths
// https://code.claude.com/docs/en/settings-reference#directory-names-with-brackets-braces-or-parentheses
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
const messages = (text: string, options: unknown[], file = PROJECT) =>
  lint(text, options, file).map((message) => message.message)
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

  it('reads * and ? after it removes a trailing /**', () => {
    for (const entry of ['/a/*.log', '/a/?', '~/*/x', '/a/**/b', '/a/b/**/']) {
      expect(ids(filesystem({ allowWrite: [entry] }), LINUX), entry).toEqual(['writeWildcard'])
    }
    for (const entry of ['/a/b/**', '~/build/**', '/a/b', './out', './app/[slug]', '/a/[bc]']) {
      expect(ids(filesystem({ allowWrite: [entry] }), LINUX), entry).toEqual([])
    }
  })

  it('is silent for a bracket in a write list on Linux and WSL2, because the name is literal', () => {
    for (const file of EVERY_FILE) {
      for (const list of ['allowWrite', 'denyWrite']) {
        expect(
          ids(filesystem({ [list]: ['./app/[slug]'] }), LINUX, file),
          `${list} ${file}`,
        ).toEqual([])
      }
    }
    expect(ids(filesystem({ allowWrite: ['./app/[slug]'] }), WSL)).toEqual([])
  })

  it('says that only a trailing /** works, and what ./src/* covers', () => {
    expect(messages(filesystem({ allowWrite: ['./src/*'] }), LINUX)).toEqual([
      'On Linux and WSL2 only a trailing `/**` works in this list. For example, `./src/*` covers only a file or directory in `src` that is itself named `*`, and nothing when there is none. Name the directory in full, or add one entry for each path.',
    ])
  })

  it('reports each entry, at its line and column', () => {
    const text =
      '{\n  "sandbox": {\n    "filesystem": {\n      "allowWrite": ["/a", "/b/*"]\n    }\n  }\n}'
    const [message] = lint(text, LINUX)
    expect([message?.line, message?.column]).toEqual([4, 28])
  })

  it('reports a read entry at its line and column', () => {
    const text =
      '{\n  "sandbox": {\n    "filesystem": {\n      "denyRead": ["/a", "/**/x"]\n    }\n  }\n}'
    const [message] = lint(text, LINUX)
    expect([message?.messageId, message?.line, message?.column]).toEqual(['readWildcard', 4, 26])
  })

  it('is silent for denyRead and allowRead with a wildcard after the first directory name', () => {
    expect(ids(filesystem({ denyRead: ['/a/*'], allowRead: ['/b/*'] }), LINUX)).toEqual([])
    expect(ids(filesystem({ denyRead: ['/srv/**/*.pem'] }), LINUX)).toEqual([])
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

describe(`${name}: read lists on Linux and WSL2`, () => {
  it('reports an absolute entry with a wildcard in the first directory name', () => {
    expect(messages(filesystem({ denyRead: ['/**/*.pem'] }), LINUX)).toEqual([
      'On Linux and WSL2 a wildcard in a "denyRead" or "allowRead" entry works only after the first directory name of the full path, so the wildcard of this entry does not work. Write the first directory name in full, with one entry for each top-level directory.',
    ])
  })

  it('reads denyRead and allowRead, `/` and `//`, and `*`, `?` and `**` in the first name', () => {
    for (const list of ['denyRead', 'allowRead']) {
      for (const entry of ['/**/*.pem', '//**/x', '/*/x', '/v?r/x', '/da*/x', '/*', '/**/x/**']) {
        for (const options of [LINUX, WSL]) {
          expect(ids(filesystem({ [list]: [entry] }), options), `${list} ${entry}`).toEqual([
            'readWildcard',
          ])
        }
      }
    }
  })

  it('is silent for a wildcard after the first name, a trailing /**, and no wildcard', () => {
    for (const entry of ['/srv/**/*.pem', '//srv/*.pem', '/**', '/', '//', '/srv', '/srv/**']) {
      expect(ids(filesystem({ denyRead: [entry] }), LINUX), entry).toEqual([])
    }
  })

  it('is silent for a ~/ entry, a ./ entry and an entry with no prefix, whose first name is part of a known path', () => {
    for (const entry of ['~/**/*.pem', '~/*/x', './**/*.pem', './*/x', '*/x', '**/*.pem']) {
      expect(ids(filesystem({ denyRead: [entry], allowRead: [entry] }), LINUX), entry).toEqual([])
    }
  })

  it('is silent on macOS, on Windows, and with no platform, where the part is off', () => {
    const text = filesystem({ denyRead: ['/**/*.pem'] })
    expect(ids(text, MAC)).toEqual([])
    expect(ids(text, WINDOWS)).toEqual([])
    expect(ids(text, [])).toEqual([])
  })

  it('does not read an entry that is not a string', () => {
    expect(ids(filesystem({ denyRead: [1, null], allowRead: 'x' }), LINUX)).toEqual([])
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

  it('says that the wildcard does not work, and where to add each path', () => {
    expect(
      lint(settings({ deny: ['Edit(*.env)'] }), LINUX).map((message) => message.message),
    ).toEqual([
      'On Linux and WSL2 a wildcard other than a trailing `/**` in an `Edit` rule does not work for sandboxed commands. Add each path that the rule should cover, or the directory that holds them, to "allowWrite" for an allow rule or "denyWrite" for a deny rule.',
    ])
  })

  it('is silent for a bracket in an Edit rule, which names a real directory', () => {
    expect(
      ids(settings({ allow: ['Edit(./app/[slug]/**)', 'Edit(./app/[slug])'] }), LINUX),
    ).toEqual([])
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

  it('is silent for an ask rule, which the sandbox reads for no domain', () => {
    expect(ids(JSON.stringify({ permissions: { ask: ['WebFetch(domain:[::1])'] } }), OLD)).toEqual(
      [],
    )
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
      ids(
        JSON.stringify({
          permissions: {
            allow: ['WebFetch(domain:a.com)', 'WebFetch', 'WebFetch(other:[::1])', 'Read'],
          },
        }),
        OLD,
      ),
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

describe(`${name}: reversed bracket range before v2.1.304`, () => {
  const OLD_LINUX = [{ platforms: ['linux'], minVersion: '2.1.303' }]
  const OLD_WSL = [{ platforms: ['wsl'], minVersion: '2.1.303' }]
  const entry = (value: string, list = 'denyRead') => filesystem({ [list]: [value] })

  it('reports ./app/[user-id] in denyRead and allowRead, on linux and on wsl', () => {
    for (const options of [OLD_LINUX, OLD_WSL]) {
      for (const list of ['denyRead', 'allowRead']) {
        expect(ids(entry('./app/[user-id]', list), options), list).toEqual(['reversedRange'])
      }
    }
    expect(ids(entry('./app/[post-id]'), OLD_LINUX)).toEqual(['reversedRange'])
  })

  it('reports in every file, at the entry, with the minVersion and the fix in the text', () => {
    for (const file of EVERY_FILE) {
      expect(ids(entry('./app/[user-id]'), OLD_LINUX, file), file).toEqual(['reversedRange'])
    }
    const [message] = lint(entry('./app/[user-id]'), OLD_LINUX)
    expect([message?.line, message?.column]).toEqual([1, 39])
    // The first entry starts at column 39, and `"./a/[a-z]",` takes 12 columns.
    const pair = lint(filesystem({ denyRead: ['./a/[a-z]', './b/[z-a]'] }), OLD_LINUX)
    expect(pair.map((report) => [report.messageId, report.column])).toEqual([['reversedRange', 51]])
    const both = lint(filesystem({ denyRead: ['./a/[z-a]', './b/[z-a]'] }), OLD_LINUX)
    expect(both.map((report) => report.column)).toEqual([39, 51])
    expect(message?.message).toBe(
      'Before Claude Code v2.1.304, sandboxed commands on Linux and WSL2 failed to start while "denyRead" or "allowRead" held a bracket expression with a reversed range, such as `[user-id]`. Your minVersion is 2.1.303. Raise the minimum version to 2.1.304, or rename the directory.',
    )
  })

  it('is silent at 2.1.304 or later, with no minVersion, and with no Linux platform', () => {
    const text = entry('./app/[user-id]')
    expect(ids(text, [{ platforms: ['linux'], minVersion: '2.1.304' }])).toEqual([])
    expect(ids(text, [{ platforms: ['linux'], minVersion: '2.2.0' }])).toEqual([])
    expect(ids(text, LINUX)).toEqual([])
    expect(ids(text, WSL)).toEqual([])
    expect(ids(text, [{ minVersion: '2.1.303' }])).toEqual([])
    expect(ids(text, [{ platforms: ['macos'], minVersion: '2.1.303' }])).toEqual([])
    expect(ids(text, [{ platforms: ['windows-git-bash'], minVersion: '2.1.303' }])).toEqual([])
    expect(ids(text, [{}])).toEqual([])
  })

  it('is silent in allowWrite and denyWrite, which the start failure does not name', () => {
    for (const list of ['allowWrite', 'denyWrite']) {
      expect(ids(entry('./app/[user-id]', list), OLD_LINUX), list).toEqual([])
    }
  })

  it('is silent for a range in order, and for a one-character range', () => {
    expect(ids(entry('./app/[a-z]'), OLD_LINUX)).toEqual([])
    expect(ids(entry('./app/[a-a]'), OLD_LINUX)).toEqual([])
    expect(ids(entry('./app/[slug]'), OLD_LINUX)).toEqual([])
  })

  it('compares code points: an upper case letter sorts before a lower case letter', () => {
    expect(ids(entry('./app/[Z-a]'), OLD_LINUX)).toEqual([])
    expect(ids(entry('./app/[a-Z]'), OLD_LINUX)).toEqual(['reversedRange'])
    expect(ids(entry('./app/[z-a]'), OLD_LINUX)).toEqual(['reversedRange'])
  })

  it('reads a character outside the basic plane as one character', () => {
    expect(ids(entry('./app/[\u{1F600}-\u{1F601}]'), OLD_LINUX)).toEqual([])
    expect(ids(entry('./app/[\u{1F601}-\u{1F600}]'), OLD_LINUX)).toEqual(['reversedRange'])
  })

  it('reports a reversed range inside a larger set, and in a later set', () => {
    expect(ids(entry('./app/[a-cz-x]'), OLD_LINUX)).toEqual(['reversedRange'])
    expect(ids(entry('./app/[a-cx-z]'), OLD_LINUX)).toEqual([])
    expect(ids(entry('./app/[ab]/[z-a]'), OLD_LINUX)).toEqual(['reversedRange'])
  })

  it('reads a hyphen right after a range as a plain character', () => {
    expect(ids(entry('./app/[a-c-b]'), OLD_LINUX)).toEqual([])
    expect(ids(entry('./app/[a-c-b-a]'), OLD_LINUX)).toEqual(['reversedRange'])
    expect(ids(entry('./app/[z--]'), OLD_LINUX)).toEqual(['reversedRange'])
  })

  it('reports a negated set, because the rule reads the range and not the negation', () => {
    expect(ids(entry('./app/[!z-a]'), OLD_LINUX)).toEqual(['reversedRange'])
    expect(ids(entry('./app/[^z-a]'), OLD_LINUX)).toEqual(['reversedRange'])
    expect(ids(entry('./app/[!a-z]'), OLD_LINUX)).toEqual([])
    expect(ids(entry('./app/[!- ]'), OLD_LINUX)).toEqual([])
    expect(ids(entry('./app/[^- ]'), OLD_LINUX)).toEqual([])
    // Only the first `!` is the negation. The second `!` is the left end of a range.
    expect(ids(entry('./app/[!!- ]'), OLD_LINUX)).toEqual(['reversedRange'])
  })

  it('is silent for a hyphen first or last, which is no range', () => {
    expect(ids(entry('./app/[-a]'), OLD_LINUX)).toEqual([])
    expect(ids(entry('./app/[a-]'), OLD_LINUX)).toEqual([])
    expect(ids(entry('./app/[!-a]'), OLD_LINUX)).toEqual([])
  })

  it('is silent for an escaped bracket, an escaped hyphen and an unclosed bracket', () => {
    expect(ids(entry('./app/\\[user-id]'), OLD_LINUX)).toEqual([])
    expect(ids(entry('./app/[z\\-a]'), OLD_LINUX)).toEqual([])
    // Read as plain characters, `\` sorts after `A`. So this case fails if the escape is lost.
    expect(ids(entry('./app/[z\\-A]'), OLD_LINUX)).toEqual([])
    expect(ids(entry('./app/[user-id'), OLD_LINUX)).toEqual([])
    expect(ids(entry('./app/[a\\'), OLD_LINUX)).toEqual([])
    expect(ids(entry('./app/[z-a\\'), OLD_LINUX)).toEqual([])
    expect(ids(entry('./app/user-id]'), OLD_LINUX)).toEqual([])
  })

  it('reads an escaped backslash as one character, so the next bracket opens a set', () => {
    expect(ids(entry('./app/\\\\[user-id]'), OLD_LINUX)).toEqual(['reversedRange'])
  })

  it('reads an escaped end point of a range', () => {
    expect(ids(entry('./app/[\\z-a]'), OLD_LINUX)).toEqual(['reversedRange'])
    // An escaped `]` is a member of the set, and does not close it.
    expect(ids(entry('./app/[\\]z-a]'), OLD_LINUX)).toEqual(['reversedRange'])
    expect(ids(entry('./app/[a-\\z]'), OLD_LINUX)).toEqual([])
  })

  it('is silent for an empty set, and for a set closed at once', () => {
    expect(ids(entry('./app/[]'), OLD_LINUX)).toEqual([])
    expect(ids(entry('./app/[!]'), OLD_LINUX)).toEqual([])
  })

  it('closes a set at a `]` right after the `[`, so the rest is plain text', () => {
    expect(ids(entry('./app/[]z-a]'), OLD_LINUX)).toEqual([])
    expect(ids(entry('./app/[!]z-a]'), OLD_LINUX)).toEqual([])
  })

  it('keeps the other parts: a wildcard report and a range report on one entry', () => {
    expect(ids(entry('/*/[user-id]'), OLD_LINUX).sort()).toEqual(['readWildcard', 'reversedRange'])
  })
})

describe(`${name}: the parts together`, () => {
  it('reports each part that its option turns on', () => {
    const text = JSON.stringify({
      sandbox: {
        failIfUnavailable: true,
        filesystem: { allowWrite: ['/tmp/*'], denyRead: ['/a/', './b/[z-a]'] },
        network: { allowUnixSockets: ['/a'], allowedDomains: ['[::1]'] },
      },
    })
    const all = [{ platforms: ['linux', 'windows-no-git-bash'], minVersion: '2.1.100' }]
    expect(ids(text, all).sort()).toEqual(
      [
        'failIfUnavailable',
        'ipv6',
        'reversedRange',
        'trailingSlash',
        'unixSockets',
        'writeWildcard',
      ].sort(),
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

describe(`${name}: review round 1 pins`, () => {
  it('reports a bare prefix with a trailing slash, and the message gives a version to raise to', () => {
    for (const entry of ['~/', '/', './']) {
      const [message] = lint(filesystem({ denyRead: [entry] }), OLD)
      expect(message?.messageId, entry).toBe('trailingSlash')
      expect(message?.message).toContain('2.1.224')
    }
  })

  it('names the version in the IPv6 message', () => {
    expect(lint(network({ allowedDomains: ['[::1]'] }), OLD)[0]?.message).toContain('2.1.200')
    expect(lint(network({ allowedDomains: ['[::1]'] }), OLD)[0]?.message).toContain('2.1.229')
  })

  it('treats a quoted value other than "true" as off in a managed file', () => {
    const fail = (value: unknown) => JSON.stringify({ sandbox: { failIfUnavailable: value } })
    expect(ids(fail('false'), WINDOWS, MANAGED)).toEqual([])
    expect(ids(fail('yes'), WINDOWS, MANAGED)).toEqual([])
  })

  it('rejects an option that the schema does not allow', () => {
    for (const option of [
      { platforms: ['linux', 'linux'] },
      { extra: 1 },
      { minVersion: '2.1.200x' },
      { minVersion: 'v2.1.200' },
    ]) {
      expect(() => lint('{}', [option]), JSON.stringify(option)).toThrow(/Key "rules"/)
    }
  })
})
