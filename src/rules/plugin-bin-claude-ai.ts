// claude.ai and Cowork do not install a plugin that has a top-level `bin/` folder
// (docs/rules/plugin-bin-claude-ai.md). No file says that a plugin targets claude.ai. The option
// `targets` names it, as it does for `mcp-plugin-stdio-reach`, and the rule reports nothing
// without `claude-ai` in it. It makes no report when it cannot see the plugin or the folder.
import { Stats } from 'node:fs'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lookup, readPlugin } from '../plugin-manifest.ts'
import { statOf } from '../skill-tree.ts'

const name = 'plugin-bin-claude-ai' as const

type Options = [{ targets: string[] }]

const rule: JSONRuleDefinition<{ RuleOptions: Options; MessageIds: 'bin' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not ship a top-level bin folder in a plugin that targets claude.ai',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { targets: { type: 'array', items: { enum: ['claude-ai'] } } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ targets: [] }],
    messages: {
      bin: 'The plugin has a top-level `bin/` folder. claude.ai and Cowork do not install a plugin that has one. Move the executables out of `bin/`, or remove `claude-ai` from the option `targets`.',
    },
  },
  create(context) {
    const [{ targets }] = context.options
    if (!targets.includes('claude-ai')) {
      return {}
    }
    const plugin = readPlugin(context.filename)
    return {
      Document(node) {
        if (plugin === undefined) {
          return
        }
        // A link to a folder out of the plugin, a link with no target, and a path that the rule
        // cannot read give no real path inside the plugin.
        const real = lookup(plugin, 'bin')
        if (typeof real !== 'string') {
          return
        }
        const stat = statOf(real)
        if (stat instanceof Stats && stat.isDirectory()) {
          context.report({ node, messageId: 'bin' })
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
