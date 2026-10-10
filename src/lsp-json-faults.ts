// The faults of a `.lsp.json` (docs/rules/lsp-json-schema.md). The file is an object that maps a
// server name to its config. When any entry is invalid, Claude Code skips the whole file, and
// `Invalid LSP server config for ".lsp.json"` appears in the `/plugin` Errors tab. The rule
// `lsp-json-schema` reports each fault. The reader of the LSP servers of a plugin drops a file
// that has one.
// (https://code.claude.com/docs/en/plugins/components#lsp-servers)
import { keyOf, lastMember, type MemberNode, type ValueNode } from './marketplace-json.ts'
import { lastMembers } from './mcp-servers.ts'

export type LspFaultId =
  | 'notObject'
  | 'entryNotObject'
  | 'unknownKey'
  | 'missing'
  | 'valueType'
  | 'commandSpace'
  | 'emptyMap'
  | 'extensionKey'
  | 'extensionValue'

const isString = (value: ValueNode) => value.type === 'String'
const isBoolean = (value: ValueNode) => value.type === 'Boolean'
const isWhole = (value: ValueNode, least: number) =>
  value.type === 'Number' && Number.isInteger(value.value) && value.value >= least

/** The documented keys of a config, each with what its value must be and the check. A key with
 *  no check takes any value. The plugins reference gives no type for it. */
const KEYS: ReadonlyMap<string, { expected: string; ok: (value: ValueNode) => boolean }> = new Map([
  ['command', { expected: 'a string', ok: isString }],
  ['extensionToLanguage', { expected: 'an object', ok: (value) => value.type === 'Object' }],
  [
    'args',
    {
      expected: 'an array of strings',
      ok: (value) => value.type === 'Array' && value.elements.every((item) => isString(item.value)),
    },
  ],
  [
    'transport',
    {
      expected: 'stdio or socket',
      ok: (value) => value.type === 'String' && ['stdio', 'socket'].includes(value.value),
    },
  ],
  [
    'env',
    {
      expected: 'an object of strings',
      ok: (value) =>
        value.type === 'Object' && lastMembers(value.members).every((m) => isString(m.value)),
    },
  ],
  ['initializationOptions', { expected: 'any value', ok: () => true }],
  ['settings', { expected: 'any value', ok: () => true }],
  ['workspaceFolder', { expected: 'a string', ok: isString }],
  ['startupTimeout', { expected: 'a positive integer', ok: (value) => isWhole(value, 1) }],
  ['shutdownTimeout', { expected: 'a positive integer', ok: (value) => isWhole(value, 1) }],
  ['requestTimeout', { expected: 'a positive integer', ok: (value) => isWhole(value, 1) }],
  ['restartOnCrash', { expected: 'a Boolean', ok: isBoolean }],
  ['maxRestarts', { expected: 'an integer of zero or more', ok: (value) => isWhole(value, 0) }],
  ['diagnostics', { expected: 'a Boolean', ok: isBoolean }],
])

const REQUIRED = ['command', 'extensionToLanguage']

/** One fault: the node to report, the message id and the data of the message. */
export interface LspFault {
  readonly node: ValueNode | MemberNode['name']
  readonly messageId: LspFaultId
  readonly data?: Record<string, string>
}

/** The faults of the top-level value `body` of a `.lsp.json`. The list is empty for a file that
 *  Claude Code loads. */
export function lspJsonFaults(body: ValueNode): LspFault[] {
  const faults: LspFault[] = []
  const report = (fault: LspFault) => faults.push(fault)
  if (body.type !== 'Object') {
    report({ node: body, messageId: 'notObject' })
    return faults
  }
  for (const member of lastMembers(body.members)) {
    const server = keyOf(member.name)
    const config = member.value
    if (config.type !== 'Object') {
      report({ node: config, messageId: 'entryNotObject', data: { server } })
      continue
    }
    for (const key of REQUIRED) {
      if (lastMember(config, key) === undefined) {
        report({ node: config, messageId: 'missing', data: { server, key } })
      }
    }
    for (const field of lastMembers(config.members)) {
      const key = keyOf(field.name)
      const value = field.value
      const documented = KEYS.get(key)
      if (documented === undefined) {
        report({ node: field.name, messageId: 'unknownKey', data: { server, key } })
      } else if (!documented.ok(value)) {
        const { expected } = documented
        report({ node: value, messageId: 'valueType', data: { server, key, expected } })
      } else if (value.type === 'String' && key === 'command') {
        if (/\s/.test(value.value) && !value.value.startsWith('/')) {
          report({ node: value, messageId: 'commandSpace', data: { server } })
        }
      } else if (value.type === 'Object' && key === 'extensionToLanguage') {
        if (value.members.length === 0) {
          report({ node: value, messageId: 'emptyMap', data: { server } })
        }
        for (const extension of lastMembers(value.members)) {
          const text = keyOf(extension.name)
          if (!text.startsWith('.')) {
            report({
              node: extension.name,
              messageId: 'extensionKey',
              data: { server, extension: text },
            })
          }
          if (extension.value.type !== 'String') {
            report({
              node: extension.value,
              messageId: 'extensionValue',
              data: { server, extension: text },
            })
          }
        }
      }
    }
  }
  return faults
}
