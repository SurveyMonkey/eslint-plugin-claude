// The shape of `.lsp.json` at a plugin root (docs/rules/lsp-json-schema.md). The file is an
// object that maps a server name to its config. It has no wrapper. A config is a strict object
// with the fields of the `lspServers` table of the plugins reference. When any entry is invalid,
// Claude Code skips the whole file, and `Invalid LSP server config for ".lsp.json"` appears in
// the `/plugin` Errors tab. `claude plugin validate` does not read the file. The inline
// `lspServers` of `plugin.json` is a different file, and validate checks it. A `transport` of
// `socket` is valid here. `lsp-transport-socket` reports it.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { atPluginRoot } from '../lsp-servers.ts'
import { keyOf, lastMember, type ValueNode } from '../marketplace-json.ts'
import { lastMembers } from '../mcp-servers.ts'

const name = 'lsp-json-schema' as const

type MessageId =
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
      ok: (value) => value.type === 'Object' && value.members.every((m) => isString(m.value)),
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

const rule: JSONRuleDefinition<{ MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write .lsp.json as a map of server names to configs with the documented fields',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      notObject:
        '.lsp.json is an object that maps a server name to its config. Claude Code skips the whole file.',
      entryNotObject:
        'The config of the LSP server "{{server}}" is an object. Claude Code skips the whole file.',
      unknownKey:
        'The key "{{key}}" in the config of the LSP server "{{server}}" is not a documented field. A config is a strict object, so Claude Code skips the whole file.',
      missing:
        'The config of the LSP server "{{server}}" needs "{{key}}". Claude Code skips the whole file.',
      valueType:
        'The value of "{{key}}" in the config of the LSP server "{{server}}" must be {{expected}}. Claude Code skips the whole file.',
      commandSpace:
        'The "command" of the LSP server "{{server}}" has whitespace and does not start with "/". Put the program in "command" and its arguments in "args". Claude Code skips the whole file.',
      emptyMap:
        'The "extensionToLanguage" of the LSP server "{{server}}" needs at least one entry. Claude Code skips the whole file.',
      extensionKey:
        'The extension "{{extension}}" in "extensionToLanguage" of the LSP server "{{server}}" must start with a dot, such as ".go". Claude Code skips the whole file.',
      extensionValue:
        'The language ID of "{{extension}}" in "extensionToLanguage" of the LSP server "{{server}}" must be a string. Claude Code skips the whole file.',
    },
  },
  create(context) {
    // A `.lsp.json` that is not at a plugin root is not read by Claude Code, or cannot be seen.
    if (!atPluginRoot(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        if (node.body.type !== 'Object') {
          context.report({ node: node.body, messageId: 'notObject' })
          return
        }
        for (const member of lastMembers(node.body.members)) {
          const server = keyOf(member.name)
          const config = member.value
          if (config.type !== 'Object') {
            context.report({ node: config, messageId: 'entryNotObject', data: { server } })
            continue
          }
          for (const key of REQUIRED) {
            if (lastMember(config, key) === undefined) {
              context.report({ node: config, messageId: 'missing', data: { server, key } })
            }
          }
          for (const field of lastMembers(config.members)) {
            const key = keyOf(field.name)
            const value = field.value
            const documented = KEYS.get(key)
            if (documented === undefined) {
              context.report({ node: field.name, messageId: 'unknownKey', data: { server, key } })
            } else if (!documented.ok(value)) {
              const { expected } = documented
              context.report({
                node: value,
                messageId: 'valueType',
                data: { server, key, expected },
              })
            } else if (value.type === 'String' && key === 'command') {
              if (/\s/.test(value.value) && !value.value.startsWith('/')) {
                context.report({ node: value, messageId: 'commandSpace', data: { server } })
              }
            } else if (value.type === 'Object' && key === 'extensionToLanguage') {
              if (value.members.length === 0) {
                context.report({ node: value, messageId: 'emptyMap', data: { server } })
              }
              for (const extension of lastMembers(value.members)) {
                const text = keyOf(extension.name)
                if (!text.startsWith('.')) {
                  context.report({
                    node: extension.name,
                    messageId: 'extensionKey',
                    data: { server, extension: text },
                  })
                }
                if (extension.value.type !== 'String') {
                  context.report({
                    node: extension.value,
                    messageId: 'extensionValue',
                    data: { server, extension: text },
                  })
                }
              }
            }
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.lsp.json'],
  rule,
}
