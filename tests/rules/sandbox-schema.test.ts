// The keys inside `sandbox` and their types, from the entries of the settings reference:
// https://code.claude.com/docs/en/settings-reference#sandbox-settings
// The block lists the keys of `sandbox`, `sandbox.filesystem`, `sandbox.network` and
// `sandbox.credentials`. A managed file repairs each field on its own, and a quoted Boolean counts
// as that Boolean:
// https://code.claude.com/docs/en/managed-settings#invalid-values-inside-sandbox
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'sandbox-schema'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const EVERY_FILE = [PROJECT, LOCAL, MANAGED, DROP_IN]
const MANAGED_FILES = [MANAGED, DROP_IN]
const PROJECT_FILES = [PROJECT, LOCAL]

const lint = (code: unknown, file = PROJECT) =>
  lintJson(name, typeof code === 'string' ? code : JSON.stringify(code), file)
const ids = (code: unknown, file = PROJECT) => lint(code, file).map((message) => message.messageId)
const sandbox = (fields: object) => ({ sandbox: fields })
const at = (level: 'filesystem' | 'network' | 'credentials', fields: object) =>
  sandbox({ [level]: fields })
const net = (fields: object) => at('network', fields)
const creds = (fields: object) => at('credentials', fields)

// A document with every key of the docs, each with a value of its type.
const VALID = sandbox({
  enabled: true,
  failIfUnavailable: true,
  autoAllowBashIfSandboxed: false,
  excludedCommands: ['docker *'],
  allowUnsandboxedCommands: false,
  enableWeakerNestedSandbox: false,
  enableWeakerNetworkIsolation: false,
  allowAppleEvents: false,
  bwrapPath: '/opt/admin/bwrap',
  socatPath: '/opt/admin/socat',
  ignoreViolations: { '*': ['/etc/hosts'], npm: [] },
  ripgrep: { command: '/usr/local/bin/rg', args: ['--hidden'] },
  filesystem: {
    allowWrite: ['/tmp/build', '~/.kube'],
    denyWrite: ['/etc'],
    denyRead: ['~/.aws/credentials'],
    allowRead: ['.'],
    allowManagedReadPathsOnly: true,
    disabled: false,
  },
  network: {
    allowUnixSockets: ['~/.ssh/agent-socket'],
    allowAllUnixSockets: false,
    allowLocalBinding: true,
    allowMachLookup: ['com.apple.coresimulator.*', '*'],
    allowedDomains: ['github.com', '*.npmjs.org', '[::1]:443'],
    deniedDomains: ['uploads.github.com'],
    strictAllowlist: true,
    allowManagedDomainsOnly: true,
    httpProxyPort: 8080,
    socksProxyPort: 8081,
    tlsTerminate: { caCertPath: '/etc/ca.pem', caKeyPath: '/etc/ca.key' },
  },
  credentials: {
    files: [
      { path: '~/.aws/credentials', mode: 'deny' },
      {
        path: '~/.config/gh/hosts.yml',
        mode: 'mask',
        extract: 'oauth_token:\\s*(\\S+)',
        onExtractNoMatch: 'deny',
        decode: 'jwt',
        maskClaims: ['api_key'],
        maskDuplicates: true,
        injectHosts: ['api.github.com'],
      },
    ],
    envVars: [
      { name: 'NPM_TOKEN', mode: 'deny' },
      { name: '_TOKEN2', mode: 'mask', onExtractNoMatch: 'warn', injectHosts: ['::1'] },
    ],
    allowPlaintextInject: false,
    awsPairs: [
      { accessKeyIdVar: 'A', secretAccessKeyVar: 'B' },
      { accessKeyIdVar: 'A', secretAccessKeyVar: 'B', sessionTokenVar: 'C' },
    ],
    sigv4: { streaming: 'passthrough', presigned: 'deny', sigv4a: 'deny' },
  },
})

describe(`${name}: a valid object`, () => {
  it('is silent for each key with a value of its type, in every file', () => {
    for (const file of EVERY_FILE) {
      expect(ids(VALID, file), file).toEqual([])
    }
  })

  it('is silent for an empty block, empty lists and null', () => {
    expect(ids(sandbox({}))).toEqual([])
    expect(ids({ sandbox: null })).toEqual([])
    expect(ids(sandbox({ filesystem: {}, network: {}, credentials: {} }))).toEqual([])
    expect(ids(sandbox({ excludedCommands: [], ignoreViolations: {}, enabled: null }))).toEqual([])
    expect(ids(net({ allowedDomains: [], httpProxyPort: null }))).toEqual([])
    expect(ids(creds({ files: [], envVars: [], awsPairs: [], sigv4: {} }))).toEqual([])
  })

  it('is silent for a document with no sandbox, or one that is not an object', () => {
    expect(ids({})).toEqual([])
    expect(ids('[1]')).toEqual([])
    expect(ids({ permissions: { sandbox: 'x' } })).toEqual([])
  })
})

describe(`${name}: a key that is not in the list`, () => {
  it('reports a key at each of the four levels, in every file', () => {
    const code = sandbox({
      madeUp: 1,
      filesystem: { madeUp: 1 },
      network: { madeUp: 1 },
      credentials: { madeUp: 1 },
    })
    for (const file of EVERY_FILE) {
      expect(ids(code, file), file).toEqual(Array(4).fill('unknownKey'))
    }
  })

  it('reports a key of another level, and a dotted key', () => {
    expect(ids(sandbox({ allowedDomains: [], 'network.allowedDomains': [] }))).toEqual([
      'unknownKey',
      'unknownKey',
    ])
    expect(ids(at('filesystem', { allowedDomains: [] }))).toEqual(['unknownKey'])
    expect(ids(net({ denyRead: [] }))).toEqual(['unknownKey'])
  })

  it('names the key in the message', () => {
    const [message] = lint(net({ allowDomains: [] }))
    expect(message?.message).toContain('"sandbox.network.allowDomains"')
  })

  it('reports the name of the key, at its line and column', () => {
    const text = '{\n  "sandbox": {\n    "enabeld": true\n  }\n}'
    expect(
      lint(text).map(({ line, column, endLine, endColumn }) => [line, column, endLine, endColumn]),
    ).toEqual([[3, 5, 3, 14]])
  })

  it('reports a key whose value is null, and the last of two keys of one name only', () => {
    expect(ids(sandbox({ madeUp: null }))).toEqual(['unknownKey'])
    expect(ids('{"sandbox": {"madeUp": 1, "madeUp": 2}}')).toEqual(['unknownKey'])
  })

  it('reads the last sandbox object and the last object at each level', () => {
    expect(ids('{"sandbox": {"madeUp": 1}, "sandbox": {}}')).toEqual([])
    expect(ids('{"sandbox": {"network": {"madeUp": 1}, "network": {}}}')).toEqual([])
    expect(ids('{"sandbox": {"network": {}, "network": {"madeUp": 1}}}')).toEqual(['unknownKey'])
  })

  it('does not check the keys inside a value of an object key', () => {
    const code = sandbox({
      ripgrep: { command: 'rg', madeUp: 1 },
      ignoreViolations: { madeUp: [] },
      network: { tlsTerminate: { madeUp: 1 } },
      credentials: { sigv4: { madeUp: 'deny' }, files: [{ path: 'x', mode: 'deny', madeUp: 1 }] },
    })
    expect(ids(code)).toEqual([])
  })
})

describe(`${name}: a value that is not an object`, () => {
  it('reports sandbox and each sub-object, on the value', () => {
    for (const value of ['x', 1, true, []]) {
      const label = JSON.stringify(value)
      expect(ids({ sandbox: value }), label).toEqual(['wrongType'])
      for (const level of ['filesystem', 'network', 'credentials'] as const) {
        expect(ids(at(level, value as never)), `${level} ${label}`).toEqual(['wrongType'])
      }
    }
  })

  it('says that an object is needed, and where the value is', () => {
    const text = '{\n  "sandbox": {\n    "network": "x"\n  }\n}'
    const [message] = lint(text)
    expect(message?.message).toContain('"sandbox.network" must be an object')
    expect([message?.line, message?.column]).toEqual([3, 16])
  })
})

describe(`${name}: a Boolean`, () => {
  const BOOLEANS = [
    ['enabled'],
    ['failIfUnavailable'],
    ['autoAllowBashIfSandboxed'],
    ['allowUnsandboxedCommands'],
    ['enableWeakerNestedSandbox'],
    ['enableWeakerNetworkIsolation'],
    ['allowAppleEvents'],
    ['filesystem', 'allowManagedReadPathsOnly'],
    ['filesystem', 'disabled'],
    ['network', 'allowAllUnixSockets'],
    ['network', 'allowLocalBinding'],
    ['network', 'strictAllowlist'],
    ['network', 'allowManagedDomainsOnly'],
    ['credentials', 'allowPlaintextInject'],
  ]
  const shaped = (path: string[], value: unknown) =>
    path.length === 1
      ? sandbox({ [path[0] as string]: value })
      : at(path[0] as never, { [path[1] as string]: value })

  it('reports a value that is not a Boolean, for each Boolean key, in a project file', () => {
    for (const path of BOOLEANS) {
      for (const value of ['yes', 1, [], {}, '', 'True']) {
        expect(ids(shaped(path, value)), `${path.join('.')} ${JSON.stringify(value)}`).toEqual([
          'wrongType',
        ])
      }
    }
  })

  it('reports a quoted true or false in a project file', () => {
    for (const value of ['true', 'false']) {
      expect(ids(sandbox({ enabled: value }))).toEqual(['wrongType'])
    }
  })

  it('reads a quoted true or false as that Boolean in a managed file', () => {
    for (const file of MANAGED_FILES) {
      for (const path of BOOLEANS) {
        expect(ids(shaped(path, 'true'), file), `${file} ${path.join('.')}`).toEqual([])
        expect(ids(shaped(path, 'false'), file), `${file} ${path.join('.')}`).toEqual([])
      }
      expect(ids(sandbox({ enabled: 'yes' }), file)).toEqual(['wrongType'])
    }
  })

  it('names the key and the type in the message', () => {
    const [message] = lint(sandbox({ enabled: 'yes' }))
    expect(message?.message).toContain('"sandbox.enabled" must be true or false')
  })
})

describe(`${name}: a list of strings`, () => {
  const LISTS = [
    ['excludedCommands'],
    ['filesystem', 'allowWrite'],
    ['filesystem', 'denyWrite'],
    ['filesystem', 'denyRead'],
    ['filesystem', 'allowRead'],
    ['network', 'allowUnixSockets'],
    ['network', 'allowMachLookup'],
    ['network', 'allowedDomains'],
    ['network', 'deniedDomains'],
  ]
  const shaped = (path: string[], value: unknown) =>
    path.length === 1
      ? sandbox({ [path[0] as string]: value })
      : at(path[0] as never, { [path[1] as string]: value })

  it('reports a value that is not an array, for each list, in every file', () => {
    for (const file of PROJECT_FILES) {
      for (const path of LISTS) {
        for (const value of ['x', 1, true, {}]) {
          expect(ids(shaped(path, value), file), `${file} ${path.join('.')}`).toEqual(['wrongType'])
        }
      }
    }
  })

  it('reports each entry that is not a string, with its index', () => {
    for (const path of LISTS) {
      const messages = lint(shaped(path, ['a', 3, null, { a: 1 }, ['x']]))
      expect(
        messages.map((message) => message.messageId),
        path.join('.'),
      ).toEqual(Array(4).fill('wrongType'))
      expect(messages[0]?.message).toContain(`"sandbox.${path.join('.')}[1]" must be a string`)
    }
  })

  it('says what Claude Code withholds for a deny list in a managed file', () => {
    for (const file of MANAGED_FILES) {
      const [network] = lint(net({ deniedDomains: 'x' }), file)
      expect(network?.message, file).toContain('withholds "sandbox.network.allowedDomains"')
      for (const key of ['denyRead', 'denyWrite']) {
        const [filesystem] = lint(at('filesystem', { [key]: [1] }), file)
        expect(filesystem?.message, `${file} ${key}`).toContain(
          'withholds "sandbox.filesystem.allowRead" and "sandbox.filesystem.allowWrite"',
        )
      }
    }
  })

  it('does not say it for another list, or in a project file', () => {
    const [allowed] = lint(net({ allowedDomains: 'x' }), MANAGED)
    expect(allowed?.message).not.toContain('withholds')
    for (const file of PROJECT_FILES) {
      const [denied] = lint(net({ deniedDomains: 'x' }), file)
      expect(denied?.message, file).not.toContain('withholds')
    }
  })
})

describe(`${name}: a port`, () => {
  it('reports 0, 65536, a negative number and a fraction, on both keys', () => {
    for (const key of ['httpProxyPort', 'socksProxyPort']) {
      for (const value of [0, 65536, -1, 1.5, 100000]) {
        expect(ids(net({ [key]: value })), `${key} ${value}`).toEqual(['badPort'])
      }
    }
  })

  it('is silent for the lowest and the highest port', () => {
    expect(ids(net({ httpProxyPort: 1, socksProxyPort: 65535 }))).toEqual([])
  })

  it('reports a value that is not a number', () => {
    for (const value of ['8080', true, [], {}]) {
      expect(ids(net({ httpProxyPort: value })), JSON.stringify(value)).toEqual(['wrongType'])
    }
  })

  it('names the key in the message', () => {
    const [message] = lint(net({ socksProxyPort: 0 }))
    expect(message?.message).toContain('"sandbox.network.socksProxyPort"')
    expect(message?.message).toContain('1 to 65535')
  })
})

describe(`${name}: bwrapPath and socatPath`, () => {
  it('reports a relative path, which Claude Code drops', () => {
    for (const key of ['bwrapPath', 'socatPath']) {
      for (const value of ['bwrap', './bwrap', '../bin/bwrap', '~/bwrap', '']) {
        expect(ids(sandbox({ [key]: value })), `${key} ${value}`).toEqual(['relativePath'])
      }
    }
  })

  it('is silent for an absolute path, in every file', () => {
    for (const file of EVERY_FILE) {
      expect(
        ids(sandbox({ bwrapPath: '/opt/admin/bwrap', socatPath: '/usr/bin/socat' }), file),
      ).toEqual([])
    }
  })

  it('reports a value that is not a string', () => {
    for (const value of [1, true, [], {}]) {
      expect(ids(sandbox({ bwrapPath: value })), JSON.stringify(value)).toEqual(['wrongType'])
    }
  })

  it('names the key in the message', () => {
    const [message] = lint(sandbox({ bwrapPath: 'bwrap' }))
    expect(message?.message).toContain('"sandbox.bwrapPath"')
    expect(message?.message).toContain('`bwrap`')
  })
})

describe(`${name}: allowMachLookup`, () => {
  it('is silent for a name, a trailing star and a lone star', () => {
    expect(ids(net({ allowMachLookup: ['com.apple.x', 'com.apple.*', '*'] }))).toEqual([])
  })

  it('reports a star that does not end the name, and a second star', () => {
    for (const entry of ['*.apple', 'com.*.x', 'a*b', '**', 'a**', '*a*']) {
      expect(ids(net({ allowMachLookup: [entry] })), entry).toEqual(['machWildcard'])
    }
  })

  it('names the entry in the message', () => {
    const [message] = lint(net({ allowMachLookup: ['*.apple'] }))
    expect(message?.message).toContain('`*.apple`')
  })

  it('does not read a star in another list', () => {
    expect(ids(net({ allowedDomains: ['*.a.*'], allowUnixSockets: ['/tmp/*.sock'] }))).toEqual([])
  })
})

describe(`${name}: ignoreViolations`, () => {
  it('reports a value that is not an object', () => {
    for (const value of ['x', ['a'], 1]) {
      expect(ids(sandbox({ ignoreViolations: value })), JSON.stringify(value)).toEqual([
        'wrongType',
      ])
    }
  })

  it('reports a command whose value is not an array of strings', () => {
    const code = sandbox({ ignoreViolations: { a: 'x', b: ['y', 1], c: [], d: null } })
    const messages = lint(code)
    expect(messages.map((message) => message.messageId)).toEqual(['wrongType', 'wrongType'])
    expect(messages[0]?.message).toContain(
      '"sandbox.ignoreViolations.a" must be an array of strings',
    )
    expect(messages[1]?.message).toContain('"sandbox.ignoreViolations.b[1]" must be a string')
  })
})

describe(`${name}: ripgrep and tlsTerminate`, () => {
  it('reports a value that is not an object', () => {
    expect(ids(sandbox({ ripgrep: 'rg' }))).toEqual(['wrongType'])
    expect(ids(net({ tlsTerminate: true }))).toEqual(['wrongType'])
  })

  it('reports ripgrep with no command, a command that is not a string, and bad args', () => {
    expect(ids(sandbox({ ripgrep: {} }))).toEqual(['missingField'])
    expect(ids(sandbox({ ripgrep: { command: 1 } }))).toEqual(['wrongType'])
    expect(ids(sandbox({ ripgrep: { command: 'rg', args: '--hidden' } }))).toEqual(['wrongType'])
    expect(ids(sandbox({ ripgrep: { command: 'rg', args: ['a', 1] } }))).toEqual(['wrongType'])
  })

  it('names the missing field and its object', () => {
    const [message] = lint(sandbox({ ripgrep: {} }))
    expect(message?.message).toContain('"sandbox.ripgrep" needs "command"')
  })

  it('reports a certificate path that is not a string', () => {
    expect(ids(net({ tlsTerminate: { caCertPath: 1, caKeyPath: ['x'] } }))).toEqual([
      'wrongType',
      'wrongType',
    ])
  })
})

describe(`${name}: credentials`, () => {
  it('reports a list that is not an array, and an entry that is not an object', () => {
    expect(ids(creds({ files: 'x', envVars: {}, awsPairs: 1 }))).toEqual([
      'wrongType',
      'wrongType',
      'wrongType',
    ])
    expect(ids(creds({ files: ['x', 1, null, []] }))).toEqual(Array(4).fill('wrongType'))
  })

  it('reports an entry with no path, no name or no mode', () => {
    expect(ids(creds({ files: [{ mode: 'deny' }, { path: 'x' }, {}] }))).toEqual([
      'missingField',
      'missingField',
      'missingField',
      'missingField',
    ])
    expect(ids(creds({ envVars: [{ mode: 'deny' }, { name: 'X' }] }))).toEqual([
      'missingField',
      'missingField',
    ])
  })

  it('reports a mode, onExtractNoMatch or decode that is not in the list', () => {
    const files = [
      { path: 'x', mode: 'allow' },
      { path: 'x', mode: 'mask', onExtractNoMatch: 'ignore' },
      { path: 'x', mode: 'mask', decode: 'base64' },
      { path: 'x', mode: 1 },
    ]
    expect(ids(creds({ files }))).toEqual(Array(4).fill('badValue'))
    expect(ids(creds({ envVars: [{ name: 'X', mode: 'MASK' }] }))).toEqual(['badValue'])
  })

  it('lists the allowed values in the message', () => {
    const [message] = lint(creds({ files: [{ path: 'x', mode: 'allow' }] }))
    expect(message?.message).toContain('"sandbox.credentials.files[0].mode"')
    expect(message?.message).toContain('"deny", "mask"')
  })

  it('reports a mask field of the wrong type', () => {
    const entry = {
      path: 'x',
      mode: 'mask',
      extract: 1,
      maskClaims: 'a',
      maskDuplicates: 'yes',
      injectHosts: [1],
    }
    expect(ids(creds({ files: [entry] }))).toEqual(Array(4).fill('wrongType'))
  })

  it('reports a variable name that is not a name', () => {
    for (const value of ['1A', 'A-B', 'A B', '', 'É']) {
      expect(ids(creds({ envVars: [{ name: value, mode: 'deny' }] })), value).toEqual(['badName'])
    }
    expect(ids(creds({ envVars: [{ name: 1, mode: 'deny' }] }))).toEqual(['wrongType'])
  })

  it('reports an awsPairs entry with no key variable, or a variable that is not a string', () => {
    expect(
      ids(creds({ awsPairs: [{ accessKeyIdVar: 'A' }, { secretAccessKeyVar: 'B' }] })),
    ).toEqual(['missingField', 'missingField'])
    expect(
      ids(
        creds({ awsPairs: [{ accessKeyIdVar: 1, secretAccessKeyVar: 'B', sessionTokenVar: 2 }] }),
      ),
    ).toEqual(['wrongType', 'wrongType'])
  })

  it('reports a sigv4 value that is not deny or passthrough', () => {
    expect(ids(creds({ sigv4: { streaming: 'allow', presigned: 1, sigv4a: 'deny' } }))).toEqual([
      'badValue',
      'badValue',
    ])
    expect(ids(creds({ sigv4: 'deny' }))).toEqual(['wrongType'])
  })
})

describe(`${name}: what the rule leaves alone`, () => {
  it('treats a required field that is null as missing, and reads a null field as removed', () => {
    expect(ids(creds({ files: [{ path: null, mode: 'deny' }] }))).toEqual(['missingField'])
    expect(ids(sandbox({ ripgrep: { command: 'rg', args: null } }))).toEqual([])
  })

  it('reads the last of two keys of one name inside an object value', () => {
    const first = '{"sandbox": {"ignoreViolations": {"a": "x", "a": []}}}'
    expect(ids(first)).toEqual([])
    const second = '{"sandbox": {"ignoreViolations": {"a": [], "a": "x"}}}'
    expect(ids(second)).toEqual(['wrongType'])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(
      ids(sandbox({ madeUp: 1, enabled: 'x', network: { httpProxyPort: 0 } }), HIDDEN),
    ).toEqual([])
  })

  it('leaves the content of a domain, a command and a path to other rules', () => {
    const code = sandbox({
      excludedCommands: ['Bash(x)', 'sudo x'],
      network: { allowedDomains: ['https://a.com', 'a.com:0'] },
      filesystem: { allowWrite: ['relative'] },
    })
    expect(ids(code)).toEqual([])
  })
})
