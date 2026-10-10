// A `.lsp.json` outside a plugin (docs/rules/lsp-json-location.md). Claude Code takes LSP
// configuration from a plugin: `.lsp.json` at the plugin root, and the `lspServers` key of the
// manifest. That key can name a `.json` file in a folder of the plugin, so a file below a plugin
// root gets no report. A `.lsp.json` at a repository root with no plugin, or under `.claude/`,
// may have no effect. The plugin manifest is optional, so a plugin with no manifest gets a false
// report. The rule reads the place of the file and not its content. A folder with an ancestor
// whose plugin root the check cannot read gets no report (ADR 001, Decision 14).
// `lsp-json-schema` reads the content.
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { isPluginRoot } from '../plugin-root.ts'

const name = 'lsp-json-location' as const

/** The nearest folder at or above `start` that holds `.git`. With no `.git`, the bound is
 *  `start`, and the rule reads nothing above it (ADR 001, Decision 14). */
function repositoryTop(start: string): string {
  for (let at = start; ; at = path.dirname(at)) {
    if (existsSync(path.join(at, '.git'))) {
      return at
    }
    if (path.dirname(at) === at) {
      return start
    }
  }
}

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
        'This `.lsp.json` is not in a plugin. The docs name a plugin as the source of LSP servers, so Claude Code may not read this file. Move it to the plugin root, next to `.claude-plugin/`.',
    },
  },
  create(context) {
    const start = path.dirname(path.resolve(context.filename))
    const top = repositoryTop(start)
    // `isPluginRoot` is true, false, or `UNREADABLE`, which is truthy. Only `false` at the
    // folder and at each folder above it, up to the repository root, is a report.
    for (let at = start; ; at = path.dirname(at)) {
      if (isPluginRoot(at) !== false) {
        return {}
      }
      if (at === top) {
        break
      }
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
