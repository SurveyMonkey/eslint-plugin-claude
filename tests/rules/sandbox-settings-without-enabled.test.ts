// `sandbox` keys in a file where no file of the source sets `sandbox.enabled` to `true`. The
// default is `false`, and then Claude Code runs commands unsandboxed:
// https://code.claude.com/docs/en/settings-reference#sandbox-enabled
// The docs show most keys as a fragment with no `enabled`. The rule reads a fragment as a file
// that sets that key. Only the `sandbox` example of the settings reference sets `enabled` too.
// The sources are files on disk: the project pair, or one managed source.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'sandbox-settings-without-enabled'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const MANAGED = 'managed-settings.json'
const DROP_IN = 'managed-settings.d/10-a.json'
const HIDDEN = 'managed-settings.d/.10-a.json'

const file = (fields: object) => JSON.stringify(fields)
const FILESYSTEM = { sandbox: { filesystem: { denyRead: ['~/.aws/credentials'] } } }
const ENABLED = { sandbox: { enabled: true } }
const at = (root: string, name_: string, text: string) =>
  lintJson(name, text, path.join(root, name_))
const alone = (fields: object | string, name_ = PROJECT) =>
  at(repo({}), name_, typeof fields === 'string' ? fields : file(fields)).map(
    (message) => message.messageId,
  )
const onDisk = (root: string, name_: string, fields: object) =>
  at(root, name_, file(fields)).map((message) => message.messageId)

describe(`${name}: one file`, () => {
  it.fails('reports a key of the sandbox with no enabled, in every kind of file', () => {
    for (const name_ of [PROJECT, LOCAL, MANAGED, DROP_IN]) {
      expect(alone(FILESYSTEM, name_), name_).toEqual(['noEnabled'])
    }
  })

  it.fails('reports the keys of the fragments in the docs', () => {
    for (const sandbox of [
      { excludedCommands: ['docker *'] },
      { failIfUnavailable: true },
      { allowUnsandboxedCommands: false },
      { autoAllowBashIfSandboxed: false },
      { network: { allowedDomains: ['github.com'] } },
      { credentials: { envVars: [{ name: 'GITHUB_TOKEN', mode: 'deny' }] } },
    ]) {
      expect(alone({ sandbox }), JSON.stringify(sandbox)).toEqual(['noEnabled'])
    }
  })

  it.fails('reports once for a block of many keys, at the sandbox value', () => {
    const text =
      '{\n  "sandbox": {\n    "failIfUnavailable": true,\n    "excludedCommands": ["a"]\n  }\n}'
    const messages = lintJson(name, text, '/repo/.claude/settings.json')
    expect(messages).toHaveLength(1)
    expect([messages[0]?.line, messages[0]?.column]).toEqual([2, 14])
  })

  it.fails('reports when enabled is false or is not a Boolean, in a project file', () => {
    for (const enabled of [false, 'true', null, 1]) {
      const sandbox = { enabled, failIfUnavailable: true }
      expect(alone({ sandbox }), JSON.stringify(enabled)).toEqual(['noEnabled'])
    }
  })

  it.fails('is silent when the file sets enabled to true, as in the sandbox example of the docs', () => {
    expect(alone({ sandbox: { ...FILESYSTEM.sandbox, enabled: true } })).toEqual([])
    expect(
      alone({
        sandbox: {
          enabled: true,
          autoAllowBashIfSandboxed: true,
          excludedCommands: ['docker *'],
          filesystem: { allowWrite: ['/tmp/build', '~/.kube'], denyRead: ['~/.aws/credentials'] },
          network: { allowedDomains: ['github.com', '*.npmjs.org'] },
        },
      }),
    ).toEqual([])
  })

  it.fails('is silent for the managed example of the docs', () => {
    expect(
      alone({
        sandbox: { enabled: true, failIfUnavailable: true, allowUnsandboxedCommands: false },
      }),
    ).toEqual([])
  })

  it.fails('counts a quoted true in a managed file only', () => {
    expect(alone({ sandbox: { enabled: 'true', excludedCommands: [] } }, MANAGED)).toEqual([])
    expect(alone({ sandbox: { enabled: 'true', excludedCommands: [] } }, PROJECT)).toEqual([
      'noEnabled',
    ])
  })

  it.fails('counts a managed enabled that is invalid as true, and false as false', () => {
    // https://code.claude.com/docs/en/managed-settings#invalid-values-inside-sandbox
    expect(alone({ sandbox: { enabled: 5, excludedCommands: [] } }, MANAGED)).toEqual([])
    expect(alone({ sandbox: { enabled: 'false', excludedCommands: [] } }, MANAGED)).toEqual([
      'noEnabled',
    ])
  })

  it.fails('is silent when the sandbox holds only enabled, or no key, or is not an object', () => {
    for (const sandbox of [{ enabled: false }, {}, [], 'on', null]) {
      expect(alone({ sandbox }), JSON.stringify(sandbox)).toEqual([])
    }
    expect(alone({})).toEqual([])
    expect(alone('[1]')).toEqual([])
  })

  it.fails('is silent in a hidden drop-in', () => {
    expect(alone(FILESYSTEM, HIDDEN)).toEqual([])
  })
})

describe(`${name}: the project pair, on disk`, () => {
  it.fails('is silent when the other file sets enabled to true', () => {
    expect(onDisk(repo({ [LOCAL]: file(ENABLED) }), PROJECT, FILESYSTEM)).toEqual([])
    expect(onDisk(repo({ [PROJECT]: file(ENABLED) }), LOCAL, FILESYSTEM)).toEqual([])
  })

  it.fails('reports when the other file sets no enabled, or sets it to false', () => {
    expect(onDisk(repo({ [LOCAL]: file({}) }), PROJECT, FILESYSTEM)).toEqual(['noEnabled'])
    const off = repo({ [LOCAL]: file({ sandbox: { enabled: false } }) })
    expect(onDisk(off, PROJECT, FILESYSTEM)).toEqual(['noEnabled'])
  })

  it.fails('does not read a managed file for a project file', () => {
    const root = repo({ [MANAGED]: file(ENABLED) })
    expect(onDisk(root, PROJECT, FILESYSTEM)).toEqual(['noEnabled'])
  })

  it.fails('is silent when the other file does not read', () => {
    for (const text of ['[1]', '{', '{"sandbox":']) {
      expect(onDisk(repo({ [LOCAL]: text }), PROJECT, FILESYSTEM), text).toEqual([])
    }
  })
})

describe(`${name}: a managed source, on disk`, () => {
  it.fails('is silent when a file of the source sets enabled to true', () => {
    expect(onDisk(repo({ [MANAGED]: file(ENABLED) }), DROP_IN, FILESYSTEM)).toEqual([])
    expect(onDisk(repo({ [DROP_IN]: file(ENABLED) }), MANAGED, FILESYSTEM)).toEqual([])
  })

  it.fails('does not read a project file for a managed file', () => {
    const root = repo({ [PROJECT]: file(ENABLED), [LOCAL]: file(ENABLED) })
    expect(onDisk(root, MANAGED, FILESYSTEM)).toEqual(['noEnabled'])
  })

  it.fails('ignores a hidden sibling, and is silent when a sibling does not read', () => {
    const hidden = repo({ 'managed-settings.d/.20-b.json': file(ENABLED) })
    expect(onDisk(hidden, DROP_IN, FILESYSTEM)).toEqual(['noEnabled'])
    const bad = repo({ 'managed-settings.d/20-b.json': '[1]' })
    expect(onDisk(bad, DROP_IN, FILESYSTEM)).toEqual([])
  })
})
