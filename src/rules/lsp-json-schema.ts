// The shape of `.lsp.json` at a plugin root (docs/rules/lsp-json-schema.md). The file is an
// object that maps a server name to its config. It has no wrapper. A config is a strict object
// with the fields of the `lspServers` table of the plugins reference. When any entry is invalid,
// Claude Code skips the whole file, and `Invalid LSP server config for ".lsp.json"` appears in
// the `/plugin` Errors tab. `claude plugin validate` does not read the file. The inline
// `lspServers` of `plugin.json` is a different file, and validate checks it. A `transport` of
// `socket` is valid here. `lsp-transport-socket` reports it.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { type LspFaultId, lspJsonFaults } from '../lsp-json-faults.ts'
import { atPluginRoot } from '../lsp-servers.ts'

const name = 'lsp-json-schema' as const

const rule: JSONRuleDefinition<{ MessageIds: LspFaultId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write .lsp.json as a map of server names to configs with the documented fields',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      notObject:
        '.lsp.json must be an object that maps a server name to its config. Claude Code skips the whole file.',
      entryNotObject:
        'The config of the LSP server "{{server}}" must be an object. Claude Code skips the whole file.',
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
        for (const { node: at, messageId, data } of lspJsonFaults(node.body)) {
          context.report({ node: at, messageId, data })
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
