// A sandbox option that the docs say reduces security or removes isolation:
// https://code.claude.com/docs/en/settings-reference#sandbox-enableweakernestedsandbox
// https://code.claude.com/docs/en/sandboxing#security-limitations
// The rule reads one file. The one exception is `autoAllowBashIfSandboxed`, which the rule
// reads in the files of the source, because a file that sets it to false removes the fault.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'sandbox-weakening-options'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const MANAGED = 'managed-settings.json'
const DROP_IN = 'managed-settings.d/10-a.json'
const HIDDEN = 'managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]

const sandbox = (fields: object) => JSON.stringify({ sandbox: fields })
const network = (fields: object) => sandbox({ network: fields })
const at = (root: string, file: string, text: string) => lintJson(name, text, path.join(root, file))
const ids = (text: string, file = PROJECT) =>
  at(repo({}), file, text).map((message) => message.messageId)

describe(`${name}: the options that any file can set`, () => {
  const CASES: [string, string, string][] = [
    ['weakerNested', sandbox({ enableWeakerNestedSandbox: true }), 'enableWeakerNestedSandbox'],
    [
      'weakerNetwork',
      sandbox({ enableWeakerNetworkIsolation: true }),
      'enableWeakerNetworkIsolation',
    ],
    ['allUnixSockets', network({ allowAllUnixSockets: true }), 'allowAllUnixSockets'],
    ['dockerSocket', network({ allowUnixSockets: ['/var/run/docker.sock'] }), 'docker.sock'],
    ['machLookupAll', network({ allowMachLookup: ['*'] }), 'allowMachLookup'],
  ]

  it('reports each option, in every file', () => {
    for (const [messageId, text] of CASES) {
      for (const file of EVERY_FILE) {
        expect(ids(text, file), `${messageId} ${file}`).toEqual([messageId])
      }
    }
  })

  it('names the option in the message', () => {
    for (const [, text, word] of CASES) {
      expect(at(repo({}), PROJECT, text)[0]?.message, word).toContain(word)
    }
  })

  it('is silent for false, a missing option, and another value', () => {
    expect(
      ids(
        sandbox({
          enableWeakerNestedSandbox: false,
          enableWeakerNetworkIsolation: false,
          network: {
            allowAllUnixSockets: false,
            allowUnixSockets: ['~/.ssh/agent-socket'],
            allowMachLookup: ['com.apple.coresimulator.*'],
          },
        }),
      ),
    ).toEqual([])
    expect(ids('{}')).toEqual([])
    expect(ids(sandbox({ enableWeakerNestedSandbox: 'true' }))).toEqual([])
  })

  it('reports the weaker network isolation with no proxy port', () => {
    expect(ids(sandbox({ enableWeakerNetworkIsolation: true }))).toEqual(['weakerNetwork'])
    expect(
      ids(sandbox({ enableWeakerNetworkIsolation: true, network: { httpProxyPort: 8080 } })),
    ).toEqual(['weakerNetwork'])
  })

  it('reports the docker socket by its file name, and each socket entry', () => {
    for (const socket of ['docker.sock', '/var/run/docker.sock', '~/.docker/run/docker.sock']) {
      expect(ids(network({ allowUnixSockets: [socket] })), socket).toEqual(['dockerSocket'])
    }
    expect(ids(network({ allowUnixSockets: ['/a/docker.sock', '/b/docker.sock'] }))).toEqual([
      'dockerSocket',
      'dockerSocket',
    ])
    expect(
      ids(network({ allowUnixSockets: ['/var/run/mydocker.sock', '/docker.sock.d/x'] })),
    ).toEqual([])
  })

  it('reports only the entry * of allowMachLookup, and each such entry', () => {
    expect(ids(network({ allowMachLookup: ['a.b', '*', 'c.*'] }))).toEqual(['machLookupAll'])
    expect(ids(network({ allowMachLookup: ['com.*'] }))).toEqual([])
  })

  it('does not read an entry that is not a string, or a list that is not an array', () => {
    expect(ids(network({ allowUnixSockets: [1, null], allowMachLookup: [5] }))).toEqual([])
    expect(ids(network({ allowUnixSockets: 'docker.sock', allowMachLookup: '*' }))).toEqual([])
  })

  it('reports the value, at its line and column', () => {
    const text = '{\n  "sandbox": {\n    "enableWeakerNestedSandbox": true\n  }\n}'
    const [message] = at(repo({}), PROJECT, text)
    expect([message?.line, message?.column]).toEqual([3, 34])
  })

  it('counts a quoted true in a managed file only', () => {
    expect(ids(sandbox({ enableWeakerNestedSandbox: 'true' }), MANAGED)).toEqual(['weakerNested'])
    expect(ids(sandbox({ enableWeakerNestedSandbox: 'true' }), PROJECT)).toEqual([])
  })
})

describe(`${name}: the options for user and managed settings`, () => {
  const CASES: [string, string][] = [
    ['appleEvents', sandbox({ allowAppleEvents: true })],
    ['plaintextInject', sandbox({ credentials: { allowPlaintextInject: true } })],
  ]

  it('reports each option in a managed file and a drop-in', () => {
    for (const [messageId, text] of CASES) {
      for (const file of [MANAGED, DROP_IN]) {
        expect(ids(text, file), `${messageId} ${file}`).toEqual([messageId])
      }
    }
  })

  it('is silent in a project and a local file, where settings-key-scope reports the key', () => {
    for (const [messageId, text] of CASES) {
      for (const file of [PROJECT, LOCAL]) {
        expect(ids(text, file), `${messageId} ${file}`).toEqual([])
      }
    }
  })

  it('is silent for false', () => {
    expect(
      ids(
        sandbox({ allowAppleEvents: false, credentials: { allowPlaintextInject: false } }),
        MANAGED,
      ),
    ).toEqual([])
  })

  it('counts a quoted true in a managed file', () => {
    expect(ids(sandbox({ allowAppleEvents: 'true' }), MANAGED)).toEqual(['appleEvents'])
  })
})

describe(`${name}: filesystem.disabled`, () => {
  const DISABLED = { filesystem: { disabled: true } }

  it('reports disabled with autoAllowBashIfSandboxed unset or true, in a managed file', () => {
    for (const file of [MANAGED, DROP_IN]) {
      expect(ids(sandbox(DISABLED), file), file).toEqual(['filesystemDisabled'])
      expect(ids(sandbox({ ...DISABLED, autoAllowBashIfSandboxed: true }), file), file).toEqual([
        'filesystemDisabled',
      ])
    }
    expect(ids(sandbox({ ...DISABLED, autoAllowBashIfSandboxed: 'x' }), MANAGED)).toEqual([
      'filesystemDisabled',
    ])
  })

  it('is silent when autoAllowBashIfSandboxed is false in the file', () => {
    expect(ids(sandbox({ ...DISABLED, autoAllowBashIfSandboxed: false }), MANAGED)).toEqual([])
    expect(ids(sandbox({ ...DISABLED, autoAllowBashIfSandboxed: 'false' }), MANAGED)).toEqual([])
  })

  it('is silent for disabled false, and in a project and a local file', () => {
    expect(ids(sandbox({ filesystem: { disabled: false } }), MANAGED)).toEqual([])
    for (const file of [PROJECT, LOCAL]) {
      expect(ids(sandbox(DISABLED), file), file).toEqual([])
    }
  })

  it('is silent when another file of the source sets autoAllowBashIfSandboxed to false', () => {
    const root = repo({ [DROP_IN]: sandbox({ autoAllowBashIfSandboxed: false }) })
    expect(at(root, MANAGED, sandbox(DISABLED))).toEqual([])
    const other = repo({ [DROP_IN]: sandbox({ autoAllowBashIfSandboxed: true }) })
    expect(at(other, MANAGED, sandbox(DISABLED)).map((m) => m.messageId)).toEqual([
      'filesystemDisabled',
    ])
  })

  it('is silent when a file of the source cannot be read', () => {
    const root = repo({ [DROP_IN]: '[1]' })
    expect(at(root, MANAGED, sandbox(DISABLED))).toEqual([])
  })

  it('does not read a hidden sibling', () => {
    const root = repo({ [HIDDEN]: sandbox({ autoAllowBashIfSandboxed: false }) })
    expect(at(root, MANAGED, sandbox(DISABLED)).map((m) => m.messageId)).toEqual([
      'filesystemDisabled',
    ])
  })

  it('may report the same line as sandbox-filesystem-disabled-conflict, for another fault', () => {
    const text = sandbox({ filesystem: { disabled: true, denyRead: ['~/.aws'] } })
    expect(ids(text, MANAGED)).toEqual(['filesystemDisabled'])
  })
})

describe(`${name}: a hidden drop-in`, () => {
  it('is silent', () => {
    expect(ids(sandbox({ enableWeakerNestedSandbox: true }), HIDDEN)).toEqual([])
  })
})
