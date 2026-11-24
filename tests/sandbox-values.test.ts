// `hasInvalidSandboxValue` reads a plain `sandbox` object by the types of `SANDBOX_SHAPES`. A
// wrong type of a known key or array entry is invalid. An unknown key is not. `credentials` is
// not read. A `null` is no value. Source:
// https://code.claude.com/docs/en/managed-settings#invalid-values-inside-sandbox
import { describe, expect, it } from 'vitest'
import { hasInvalidSandboxValue } from '../src/sandbox-values.ts'

describe('hasInvalidSandboxValue', () => {
  it('accepts a valid block, an unset field and a null', () => {
    const sandbox = {
      enabled: true,
      excludedCommands: ['git'],
      ripgrep: { command: 'rg', args: null },
      ignoreViolations: { '*': ['/tmp'] },
      filesystem: { allowWrite: ['/a'], disabled: false },
      network: { allowMachLookup: ['x'], httpProxyPort: 8080, tlsTerminate: { caCertPath: '/c' } },
      autoAllowBashIfSandboxed: null,
    }
    expect(hasInvalidSandboxValue(sandbox)).toBe(false)
    expect(hasInvalidSandboxValue({})).toBe(false)
  })

  it('reads a value that is not an object as no block', () => {
    for (const value of [undefined, null, 'x', 1, [1]]) {
      expect(hasInvalidSandboxValue(value), String(value)).toBe(false)
    }
  })

  it('reports a wrong type of a known key', () => {
    const bad: object[] = [
      { enabled: 'true' },
      { enabled: 1 },
      { excludedCommands: 'x' },
      { bwrapPath: 1 },
      { ripgrep: 'rg' },
      { ripgrep: { command: 1 } },
      { ripgrep: { args: 'x' } },
      { ignoreViolations: [] },
      { ignoreViolations: { a: 'x' } },
      { ignoreViolations: { a: [1] } },
      { filesystem: [] },
      { filesystem: { allowWrite: 'x' } },
      { network: 'x' },
      { network: { httpProxyPort: '80' } },
      { network: { allowMachLookup: [1] } },
      { network: { tlsTerminate: { caCertPath: 1 } } },
    ]
    for (const sandbox of bad) {
      expect(hasInvalidSandboxValue(sandbox), JSON.stringify(sandbox)).toBe(true)
    }
  })

  it('reports an array entry of the wrong type', () => {
    expect(hasInvalidSandboxValue({ excludedCommands: [1] })).toBe(true)
    expect(hasInvalidSandboxValue({ excludedCommands: ['a', null] })).toBe(true)
  })

  it('does not report an unknown key, and does not read credentials', () => {
    expect(hasInvalidSandboxValue({ foo: 1, network: { bar: [] } })).toBe(false)
    expect(hasInvalidSandboxValue({ credentials: { files: 'x', allowPlaintextInject: 1 } })).toBe(
      false,
    )
  })
})
