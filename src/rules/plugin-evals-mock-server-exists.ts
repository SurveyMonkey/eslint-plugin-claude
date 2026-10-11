// A directory `mocks/<server>/` of an eval suite names a server in the MCP configuration of the
// plugin (docs/rules/plugin-evals-mock-server-exists.md). ESLint has no language for the
// directory, so the rule lints the manifest of the plugin, as `plugin-evals-results-gitignored`
// does, and lists the mock directories of the eval directory and of each case. The servers come
// from `pluginMcpSources` in `src/mcp-servers.ts`. The rule makes no report when a source of
// servers cannot be read (ADR 001, Decision 14).
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { pluginMcpSources } from '../mcp-servers.ts'
import { evalDirectoryOf, mockDirectories } from '../plugin-evals.ts'

const name = 'plugin-evals-mock-server-exists' as const

const rule: JSONRuleDefinition<{ MessageIds: 'unknown' }> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Name only servers of the plugin MCP configuration in the mocks of an eval suite',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unknown:
        'The directory "{{dir}}" holds mocks for the server "{{server}}". The MCP configuration of the plugin does not declare a server with that name. {{known}}',
    },
  },
  create(context) {
    return {
      Document(node) {
        const suite = evalDirectoryOf(context.filename, node)
        if (suite === null) {
          return
        }
        const mocks = mockDirectories(suite.real, suite.bound)
        if (mocks.length === 0) {
          return
        }
        const root = path.dirname(path.dirname(path.resolve(context.filename)))
        const sources = pluginMcpSources(root, node.body)
        if (!sources.complete) {
          return
        }
        const names = [...new Set(sources.declarations.map((declaration) => declaration.name))]
        const known =
          names.length === 0
            ? 'It declares no server.'
            : `It declares ${names.map((server) => `"${server}"`).join(', ')}.`
        for (const { dir, server } of mocks) {
          if (!names.includes(server)) {
            const relative = path.relative(suite.real, dir).split(path.sep).join('/')
            context.report({
              node,
              messageId: 'unknown',
              data: { dir: `${suite.name}/${relative}`, server, known },
            })
          }
        }
      },
    }
  },
}

export const target = {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/plugin.json'],
}

export default rule
