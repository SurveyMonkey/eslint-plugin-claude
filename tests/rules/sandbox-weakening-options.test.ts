// A sandbox option that the docs say reduces security or removes isolation:
// https://code.claude.com/docs/en/settings-reference#sandbox-enableweakernestedsandbox
// https://code.claude.com/docs/en/sandboxing#security-limitations
// The rule reads one file. The one exception is `autoAllowBashIfSandboxed`, which the rule
// reads in the files of the source. A file that sets it to false removes the fault. The default
// is `false`, and "Before v2.1.324, the default was `true`":
// https://code.claude.com/docs/en/settings-reference#sandbox-autoallowbashifsandboxed
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
const at = (root: string, file: string, text: string, options: unknown[] = []) =>
  lintJson(name, text, path.join(root, file), options)
const ids = (text: string, file = PROJECT, options: unknown[] = []) =>
  at(repo({}), file, text, options).map((message) => message.messageId)

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

  it('names the CoreSimulator prefix as the docs write it', () => {
    expect(at(repo({}), PROJECT, network({ allowMachLookup: ['*'] }))[0]?.message).toContain(
      'com.apple.CoreSimulator.*',
    )
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
            allowMachLookup: ['com.apple.CoreSimulator.*'],
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
    ['nestedUserNamespaces', sandbox({ allowNestedUserNamespaces: true })],
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

  it('says what allowNestedUserNamespaces turns off', () => {
    const [report] = at(repo({}), MANAGED, sandbox({ allowNestedUserNamespaces: true }))
    expect(report?.message).toBe(
      '"allowNestedUserNamespaces" turns off a security boundary: code from a sandboxed command can then run outside the sandbox. Do not rely on the sandbox restrictions while it is on.',
    )
  })

  it('is silent for false', () => {
    expect(
      ids(
        sandbox({
          allowAppleEvents: false,
          allowNestedUserNamespaces: false,
          credentials: { allowPlaintextInject: false },
        }),
        MANAGED,
      ),
    ).toEqual([])
  })

  it('counts a quoted true in a managed file', () => {
    expect(ids(sandbox({ allowAppleEvents: 'true' }), MANAGED)).toEqual(['appleEvents'])
    expect(ids(sandbox({ allowNestedUserNamespaces: 'true' }), MANAGED)).toEqual([
      'nestedUserNamespaces',
    ])
  })
})

describe(`${name}: filesystem.disabled`, () => {
  const DISABLED = { filesystem: { disabled: true } }

  it('reports disabled with autoAllowBashIfSandboxed true, in a managed file', () => {
    for (const file of [MANAGED, DROP_IN]) {
      for (const options of [[], [{ minVersion: '2.1.323' }], [{ minVersion: '2.1.324' }]]) {
        const text = sandbox({ ...DISABLED, autoAllowBashIfSandboxed: true })
        expect(ids(text, file, options), file).toEqual(['filesystemDisabled'])
      }
    }
    expect(ids(sandbox({ ...DISABLED, autoAllowBashIfSandboxed: 'true' }), MANAGED)).toEqual([
      'filesystemDisabled',
    ])
  })

  it('is silent when autoAllowBashIfSandboxed is unset or not true, from v2.1.324', () => {
    for (const file of [MANAGED, DROP_IN]) {
      for (const options of [[], [{}], [{ minVersion: '2.1.324' }], [{ minVersion: '2.2.0' }]]) {
        expect(ids(sandbox(DISABLED), file, options), file).toEqual([])
      }
    }
    expect(ids(sandbox({ ...DISABLED, autoAllowBashIfSandboxed: 'x' }), MANAGED)).toEqual([])
    expect(ids(sandbox({ ...DISABLED, autoAllowBashIfSandboxed: null }), MANAGED)).toEqual([])
  })

  it('reports disabled with autoAllowBashIfSandboxed unset when minVersion is before 2.1.324', () => {
    for (const minVersion of ['2.1.323', '2.1.300', '2.0.0']) {
      const options = [{ minVersion }]
      expect(ids(sandbox(DISABLED), MANAGED, options), minVersion).toEqual(['filesystemDisabled'])
      expect(ids(sandbox(DISABLED), DROP_IN, options), minVersion).toEqual(['filesystemDisabled'])
    }
    const odd = sandbox({ ...DISABLED, autoAllowBashIfSandboxed: 'x' })
    expect(ids(odd, MANAGED, [{ minVersion: '2.1.323' }])).toEqual(['filesystemDisabled'])
  })

  it('refuses a minVersion that is not major.minor.patch', () => {
    expect(() => ids(sandbox(DISABLED), MANAGED, [{ minVersion: '2.1' }])).toThrow(/match pattern/)
    expect(() => ids(sandbox(DISABLED), MANAGED, [{ other: true }])).toThrow(
      /additional properties/,
    )
  })

  it('is silent when autoAllowBashIfSandboxed is false in the file', () => {
    const old = [{ minVersion: '2.1.323' }]
    for (const options of [[], old]) {
      expect(
        ids(sandbox({ ...DISABLED, autoAllowBashIfSandboxed: false }), MANAGED, options),
      ).toEqual([])
      expect(
        ids(sandbox({ ...DISABLED, autoAllowBashIfSandboxed: 'false' }), MANAGED, options),
      ).toEqual([])
    }
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
    expect(at(root, MANAGED, sandbox(DISABLED), [{ minVersion: '2.1.323' }])).toEqual([])
  })

  it('reports when another file of the source sets autoAllowBashIfSandboxed to true', () => {
    const other = repo({ [DROP_IN]: sandbox({ autoAllowBashIfSandboxed: true }) })
    expect(at(other, MANAGED, sandbox(DISABLED)).map((m) => m.messageId)).toEqual([
      'filesystemDisabled',
    ])
    const unset = repo({ [DROP_IN]: sandbox({}) })
    expect(at(unset, MANAGED, sandbox(DISABLED))).toEqual([])
    expect(
      at(unset, MANAGED, sandbox(DISABLED), [{ minVersion: '2.1.323' }]).map((m) => m.messageId),
    ).toEqual(['filesystemDisabled'])
  })

  it('is silent when a file of the source cannot be read', () => {
    const root = repo({ [DROP_IN]: '[1]' })
    expect(at(root, MANAGED, sandbox(DISABLED))).toEqual([])
  })

  it('does not read a hidden sibling', () => {
    const root = repo({ [HIDDEN]: sandbox({ autoAllowBashIfSandboxed: false }) })
    const options = [{ minVersion: '2.1.323' }]
    expect(at(root, MANAGED, sandbox(DISABLED), options).map((m) => m.messageId)).toEqual([
      'filesystemDisabled',
    ])
    const hiddenOn = repo({ [HIDDEN]: sandbox({ autoAllowBashIfSandboxed: true }) })
    expect(at(hiddenOn, MANAGED, sandbox(DISABLED))).toEqual([])
  })

  it('may report the same line as sandbox-filesystem-disabled-conflict, for another fault', () => {
    const text = sandbox({
      autoAllowBashIfSandboxed: true,
      filesystem: { disabled: true, denyRead: ['~/.aws'] },
    })
    expect(ids(text, MANAGED)).toEqual(['filesystemDisabled'])
  })
})

describe(`${name}: a hidden drop-in`, () => {
  it('is silent', () => {
    expect(ids(sandbox({ enableWeakerNestedSandbox: true }), HIDDEN)).toEqual([])
  })
})

describe(`${name}: review round 1 pins`, () => {
  it('counts only the string "true" as on in a managed file', () => {
    expect(ids(sandbox({ enableWeakerNestedSandbox: 'false' }), MANAGED)).toEqual([])
    expect(ids(sandbox({ enableWeakerNestedSandbox: 'yes' }), MANAGED)).toEqual([])
    expect(ids(sandbox({ enableWeakerNestedSandbox: 'true' }), MANAGED)).toEqual(['weakerNested'])
  })

  it('does not read a path that only looks like docker.sock', () => {
    expect(ids(network({ allowUnixSockets: ['/var/run/dockerXsock'] }))).toEqual([])
  })
})
