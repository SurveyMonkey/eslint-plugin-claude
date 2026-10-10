// One plugin declares an LSP server name once (docs/rules/lsp-duplicate-server-name.md). Claude
// Code loads `.lsp.json` at the plugin root first, then each `lspServers` value of the manifest
// in order, and a later server of one name replaces an earlier one. So the earlier server never
// runs. The rule reads `.lsp.json`, each `.json` file that `lspServers` names, and the inline
// maps, through `pluginLspDeclarations`. A source that it cannot read adds no name (ADR 001,
// Decision 14).
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { pluginLspDeclarations } from '../lsp-servers.ts'
import { repeatedDeclarations } from '../mcp-servers.ts'

const name = 'lsp-duplicate-server-name' as const

const rule: JSONRuleDefinition<{ MessageIds: 'duplicate' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Declare each LSP server name of a plugin once',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      duplicate:
        'The LSP server name "{{server}}" is already declared in {{from}}. A later declaration replaces an earlier one, so Claude Code drops the earlier server. Give each server a name of its own.',
    },
  },
  create(context) {
    // The plugin root is the directory that holds `.claude-plugin/`.
    const root = path.dirname(path.dirname(path.resolve(context.filename)))
    return {
      Document(node) {
        for (const { declaration, earlier } of repeatedDeclarations(
          pluginLspDeclarations(root, node.body),
        )) {
          context.report({
            node: declaration.node,
            messageId: 'duplicate',
            data: { server: declaration.name, from: earlier },
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/plugin.json'],
  rule,
}
