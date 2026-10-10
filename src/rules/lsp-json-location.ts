// A `.lsp.json` outside a plugin root (docs/rules/lsp-json-location.md). Claude Code takes LSP
// configuration from a plugin: `.lsp.json` at the plugin root, and the `lspServers` key of the
// manifest. A `.lsp.json` at a repository root with no plugin, or under `.claude/`, does nothing.
// The rule reads the place of the file and not its content. A folder whose plugin root the check
// cannot read gets no report (ADR 001, Decision 14). `lsp-json-schema` reads the content.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { isPluginRoot } from '../plugin-root.ts'

const name = 'lsp-json-location' as const

const rule: JSONRuleDefinition<{ MessageIds: 'outside' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Put .lsp.json at the root of a plugin',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      outside:
        'This `.lsp.json` is not at the root of a plugin. Claude Code takes LSP servers from a plugin only, so it does not read this file. Move it to the plugin root, next to `.claude-plugin/`.',
    },
  },
  create(context) {
    // `isPluginRoot` is true, false, or `UNREADABLE`, which is truthy. Only `false` is a report.
    if (isPluginRoot(path.dirname(path.resolve(context.filename))) !== false) {
      return {}
    }
    return {
      Document(node) {
        context.report({ node: node.body, messageId: 'outside' })
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
