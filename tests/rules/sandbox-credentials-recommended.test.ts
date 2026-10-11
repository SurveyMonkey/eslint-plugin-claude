// The default read policy of the sandbox lets commands read credential files, and Claude Code
// protects only the entries that a source lists. The docs advise `~/.aws` and `~/.ssh`:
// https://code.claude.com/docs/en/sandboxing#enforce-sandboxing-with-managed-settings
// https://code.claude.com/docs/en/settings-reference#sandbox-filesystem-denyread
// The rule reads the project pair, or one managed source, from disk. A `filesystem.denyRead`
// entry, a `credentials.files` entry and a `Read` deny rule all count. The `sandbox` example of
// the settings reference denies `~/.aws/credentials` only, so it reports for `~/.ssh`. Claude Code
// drops a `mask` entry and the key `filesystem.disabled` from the two project files.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'sandbox-credentials-recommended'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const MANAGED = 'managed-settings.json'
const DROP_IN = 'managed-settings.d/10-a.json'
const HIDDEN = 'managed-settings.d/.10-a.json'

const file = (fields: object) => JSON.stringify(fields)
const ON = { sandbox: { enabled: true } }
const deny = (...paths: string[]) => ({
  sandbox: { enabled: true, filesystem: { denyRead: paths } },
})
const at = (root: string, name_: string, text: string) =>
  lintJson(name, text, path.join(root, name_))
const ids = (root: string, name_: string, fields: object | string) =>
  at(root, name_, typeof fields === 'string' ? fields : file(fields)).map(
    (message) => message.messageId,
  )
const alone = (fields: object | string, name_ = PROJECT) => ids(repo({}), name_, fields)
const message = (fields: object) => at(repo({}), PROJECT, file(fields))[0]?.message ?? ''

describe(`${name}: one file`, () => {
  it('reports the sandbox on with no entry, in every kind of file', () => {
    for (const name_ of [PROJECT, LOCAL, MANAGED, DROP_IN]) {
      expect(alone(ON, name_), name_).toEqual(['open'])
    }
  })

  it('names the missing directories, at the value of enabled', () => {
    const text = '{\n  "sandbox": {\n    "enabled": true\n  }\n}'
    const [report] = lintJson(name, text, '/repo/.claude/settings.json')
    expect([report?.line, report?.column]).toEqual([3, 16])
    expect(report?.message).toContain('`~/.aws`')
    expect(report?.message).toContain('`~/.ssh`')
  })

  it('names only the directory that is missing', () => {
    expect(message(deny('~/.aws/credentials'))).toContain('`~/.ssh`')
    expect(message(deny('~/.aws/credentials'))).not.toContain('`~/.aws`')
    expect(message(deny('~/.ssh'))).toContain('`~/.aws`')
    expect(message(deny('~/.ssh'))).not.toContain('`~/.ssh`')
  })

  it('reports the sandbox example of the settings reference, for the ssh directory', () => {
    expect(
      message({
        sandbox: {
          enabled: true,
          filesystem: { allowWrite: ['/tmp/build'], denyRead: ['~/.aws/credentials'] },
        },
      }),
    ).toContain('`~/.ssh`')
  })

  it('is silent when denyRead names both directories, or a path below them', () => {
    expect(alone(deny('~/.aws', '~/.ssh'))).toEqual([])
    expect(alone(deny('~/.aws/credentials', '~/.ssh/id_ed25519'))).toEqual([])
    expect(alone(deny('~/.aws/', '~/.ssh/**'))).toEqual([])
    expect(alone(deny('/home/me/.aws', '/Users/me/.ssh'))).toEqual([])
  })

  it('is silent when denyRead denies the home directory, as the docs example does', () => {
    for (const entry of ['~/', '~', '~/**', '/Users/me', '/home/me', '/root', '/']) {
      expect(alone(deny(entry)), entry).toEqual([])
    }
  })

  it('is silent when credentials.files denies or masks both directories, in a managed file', () => {
    const files = [
      { path: '~/.aws/credentials', mode: 'deny' },
      { path: '~/.ssh', mode: 'mask' },
    ]
    expect(alone({ sandbox: { enabled: true, credentials: { files } } }, MANAGED)).toEqual([])
  })

  it('does not count a mask entry in a project file, which Claude Code drops', () => {
    const files = [
      { path: '~/.aws', mode: 'mask' },
      { path: '~/.ssh', mode: 'deny' },
    ]
    for (const name_ of [PROJECT, LOCAL]) {
      expect(alone({ sandbox: { enabled: true, credentials: { files } } }, name_), name_).toEqual([
        'open',
      ])
    }
    expect(message({ sandbox: { enabled: true, credentials: { files } } })).toContain('`~/.aws`')
  })

  it('does not count a path that is relative to the project or inside another directory', () => {
    for (const entry of ['./.aws', '.ssh', 'secrets/.ssh', '/tmp/.aws', '~/work/.ssh']) {
      expect(alone(deny(entry)), entry).toEqual(['open'])
    }
    const rules = ['Read(./.aws/**)', 'Read(/Users/me/.ssh)', 'Read(.ssh)', 'Read(/)']
    for (const rule of rules) {
      expect(alone({ ...ON, permissions: { deny: [rule] } }), rule).toEqual(['open'])
    }
  })

  it('is silent when a Read deny rule covers both directories', () => {
    const permissions = { deny: ['Read(~/.aws/**)', 'Read(//Users/me/.ssh/**)'] }
    expect(alone({ ...ON, permissions })).toEqual([])
    expect(alone({ ...ON, permissions: { deny: ['Read(~/)'] } })).toEqual([])
    // A `Read` rule with no specifier denies every file.
    expect(alone({ ...ON, permissions: { deny: ['Read'] } })).toEqual([])
  })

  it('counts the entries of both lists together', () => {
    const credentials = { files: [{ path: '~/.aws', mode: 'deny' }] }
    expect(
      alone({ sandbox: { enabled: true, credentials, filesystem: { denyRead: ['~/.ssh'] } } }),
    ).toEqual([])
  })

  it('reports an entry that names another directory, or is not a string or a deny rule', () => {
    expect(alone(deny('~/.config', '~/.awsome', '~/.sshd'))).toEqual(['open'])
    expect(alone({ ...ON, permissions: { deny: ['Read(~/.aws/**)', 'Edit(~/.ssh/**)'] } })).toEqual(
      ['open'],
    )
    expect(
      alone({ ...ON, permissions: { allow: ['Read(~/.aws/**)', 'Read(~/.ssh/**)'] } }),
    ).toEqual(['open'])
    expect(alone({ sandbox: { enabled: true, filesystem: { denyRead: [1, null] } } })).toEqual([
      'open',
    ])
    for (const credentials of [
      'x',
      5,
      { files: 'x' },
      { files: { path: '~/.aws', mode: 'deny' } },
    ]) {
      expect(
        alone({ sandbox: { enabled: true, credentials } }),
        JSON.stringify(credentials),
      ).toEqual(['open'])
    }
    const files = [
      { path: '~/.aws', mode: 'allow' },
      { path: '~/.ssh', mode: 'deny' },
      'x',
      { path: 5, mode: 'deny' },
    ]
    const credentials = { files }
    expect(alone({ sandbox: { enabled: true, credentials } })).toEqual(['open'])
    expect(message({ sandbox: { enabled: true, credentials } })).toContain('`~/.aws`')
    expect(message({ sandbox: { enabled: true, credentials } })).not.toContain('`~/.ssh`')
  })

  it('is silent when filesystem isolation is off in a managed file', () => {
    const disabled = (value: unknown) => ({
      sandbox: { enabled: true, filesystem: { disabled: value } },
    })
    expect(alone(disabled(true), MANAGED)).toEqual([])
    expect(alone(disabled('true'), MANAGED)).toEqual([])
    expect(alone(disabled(5), MANAGED)).toEqual(['open'])
    expect(alone(disabled(false), MANAGED)).toEqual(['open'])
    // Claude Code ignores `disabled` in a project file, so the entries stay in force.
    for (const name_ of [PROJECT, LOCAL]) {
      expect(alone(disabled(true), name_), name_).toEqual(['open'])
    }
    // A sibling of the managed source speaks for it.
    const root = repo({ [DROP_IN]: file(disabled(true)) })
    expect(ids(root, MANAGED, ON)).toEqual([])
  })

  it('is silent when reads outside the working directory are blocked', () => {
    expect(alone({ ...ON, permissions: { blockReadsOutsideWorkingDirectories: true } })).toEqual([])
    expect(alone({ ...ON, permissions: { blockReadsOutsideWorkingDirectories: false } })).toEqual([
      'open',
    ])
  })

  it('is silent when the sandbox is off, unset, or not true', () => {
    for (const sandbox of [{ enabled: false }, {}, { enabled: 'true' }, { enabled: null }]) {
      expect(alone({ sandbox }), JSON.stringify(sandbox)).toEqual([])
    }
    expect(alone({})).toEqual([])
    expect(alone('[1]')).toEqual([])
  })

  it('counts a quoted true in a managed file', () => {
    expect(alone({ sandbox: { enabled: 'true' } }, MANAGED)).toEqual(['open'])
  })

  it('is silent in a hidden drop-in', () => {
    expect(alone(ON, HIDDEN)).toEqual([])
  })
})

describe(`${name}: the project pair, on disk`, () => {
  it('reports in the file that enables the sandbox, and not in the other', () => {
    expect(ids(repo({ [LOCAL]: file({}) }), PROJECT, ON)).toEqual(['open'])
    expect(ids(repo({ [PROJECT]: file(ON) }), LOCAL, {})).toEqual([])
  })

  it('is silent when the other file holds the entries or turns the sandbox off', () => {
    const entries = repo({
      [LOCAL]: file({ sandbox: { filesystem: { denyRead: ['~/.aws', '~/.ssh'] } } }),
    })
    expect(ids(entries, PROJECT, ON)).toEqual([])
    const rule = repo({ [LOCAL]: file({ permissions: { deny: ['Read(~/)'] } }) })
    expect(ids(rule, PROJECT, ON)).toEqual([])
    const off = repo({ [LOCAL]: file({ sandbox: { enabled: false } }) })
    expect(ids(off, PROJECT, ON)).toEqual([])
  })

  it('adds the entries of the two files', () => {
    const root = repo({ [LOCAL]: file({ sandbox: { filesystem: { denyRead: ['~/.ssh'] } } }) })
    expect(ids(root, PROJECT, deny('~/.aws'))).toEqual([])
    const half = repo({ [LOCAL]: file({ sandbox: { filesystem: { denyRead: ['~/.config'] } } }) })
    expect(ids(half, PROJECT, deny('~/.aws'))).toEqual(['open'])
  })

  it('does not read a managed file for a project file', () => {
    const root = repo({ [MANAGED]: file(deny('~/')) })
    expect(ids(root, PROJECT, ON)).toEqual(['open'])
  })

  it('is silent when the other file does not read', () => {
    for (const text of ['[1]', '{', '{"sandbox":']) {
      expect(ids(repo({ [LOCAL]: text }), PROJECT, ON), text).toEqual([])
    }
  })
})

describe(`${name}: a managed source, on disk`, () => {
  it('is silent when a file of the source holds the entries', () => {
    const root = repo({ [MANAGED]: file(deny('~/.aws', '~/.ssh')) })
    expect(ids(root, DROP_IN, ON)).toEqual([])
    expect(ids(repo({ [DROP_IN]: file(deny('~/')) }), MANAGED, ON)).toEqual([])
  })

  it('does not read a project file for a managed file', () => {
    const root = repo({ [PROJECT]: file(deny('~/')) })
    expect(ids(root, MANAGED, ON)).toEqual(['open'])
  })

  it('ignores a hidden sibling, and is silent when a sibling does not read', () => {
    const hidden = repo({ 'managed-settings.d/.20-b.json': file(deny('~/')) })
    expect(ids(hidden, DROP_IN, ON)).toEqual(['open'])
    const bad = repo({ 'managed-settings.d/20-b.json': '[1]' })
    expect(ids(bad, DROP_IN, ON)).toEqual([])
  })
})
