// A string entry of `mcpServers` refers to a server that is already configured. The rule looks
// for it in `.mcp.json` of the project (docs/rules/agent-mcp-servers-ref-exists.md). A server in
// the user config, in a plugin, or in a connector is out of sight. Claude Code ignores the field in
// a plugin agent, so the rule checks local agents only.
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { docsUrl } from '../docs-url.ts'
import { foldersAbove } from '../folders-above.ts'
import { listEntries } from '../frontmatter-list.ts'
import { isMap } from '../frontmatter-values.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import { readJson, repositoryRoot, UNREADABLE } from '../skill-tree.ts'

const name = 'agent-mcp-servers-ref-exists' as const

type Options = [{ allow: string[] }]

const rule: MarkdownRuleDefinition<{ RuleOptions: Options; MessageIds: 'missing' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Name a server that .mcp.json defines in the mcpServers of a subagent',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { allow: { type: 'array', items: { type: 'string' }, uniqueItems: true } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allow: [] }],
    messages: {
      missing:
        '`.mcp.json` of this project and of the folders above it does not define a server named `{{server}}`. A server from your user config, a plugin or a connector is out of sight. Name such a server in the option `allow`.',
    },
  },
  create(context) {
    const scope = classifyAgentFile(context.filename)
    if (scope === null || scope.plugin) {
      return {}
    }
    const [{ allow }] = context.options
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        // A value that is not a list is the business of `agent-mcp-servers-schema`. The helper
        // reads a string item as an entry. A map item has no text and gives no entry.
        if (fm === null || !Array.isArray(fm.data.mcpServers)) {
          return
        }
        // The docs do not say if Claude Code treats upper and lower case of a server name as different.
        const same = (entry: string) => (other: string) =>
          other.toLowerCase() === entry.toLowerCase()
        const entries = listEntries(fm, node.value, 'mcpServers', () => false).filter(
          // A name with a `:` is the form of a plugin server. The docs give no rule for that form
          // in `mcpServers`.
          ({ text }) => !text.includes(':') && !allow.some(same(text)),
        )
        if (entries.length === 0) {
          return
        }
        const bound = repositoryRoot(scope.root)
        const names: string[] = []
        for (const dir of [path.dirname(scope.root), ...foldersAbove(scope.root)]) {
          const parsed = readJson(path.join(dir, '.mcp.json'), bound)
          if (parsed === null) {
            continue
          }
          // A file that the rule cannot read, or that is not an object, can hold any server.
          if (parsed === UNREADABLE || !isMap(parsed.data)) {
            return
          }
          const { mcpServers } = parsed.data
          names.push(...(isMap(mcpServers) ? Object.keys(mcpServers) : []))
        }
        for (const { text, loc } of entries) {
          if (!names.some(same(text))) {
            context.report({ loc, messageId: 'missing', data: { server: text } })
          }
        }
      },
    }
  },
}

export default { name, language: 'markdown' as const, files: ['**/agents/**/*.md'], rule }
