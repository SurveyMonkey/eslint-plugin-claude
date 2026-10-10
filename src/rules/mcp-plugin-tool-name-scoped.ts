// A tool of a plugin MCP server has the scoped name `mcp__plugin_<plugin>_<server>__<tool>`
// (docs/rules/mcp-plugin-tool-name-scoped.md). Each character outside `A-Za-z0-9_-` in the name
// of the plugin and of the server is `_`. A skill, command or agent of the plugin that names its
// own server as `mcp__<server>__<tool>` matches no tool. The rule reads the plugin MCP servers
// through `pluginMcpDeclarations`, and the plugin name from the manifest. It reads the tool lists
// of the Markdown files only. A hook `matcher` and `if`, and the `server` of an `mcp_tool` hook,
// are not read. A file or source that the rule cannot read adds nothing (ADR 001, Decision 14).
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { MCP_PREFIX, MCP_SEPARATOR } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { COMMA, listEntries, SPACE_OR_COMMA } from '../frontmatter-list.ts'
import { lastMember } from '../marketplace-json.ts'
import { pluginMcpDeclarations, readJsonBody } from '../mcp-servers.ts'
import { parsePermissionRule } from '../permission-rule.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import { repositoryRoot, scopeRoot } from '../skill-tree.ts'

const name = 'mcp-plugin-tool-name-scoped' as const

/** The name with each character outside `A-Za-z0-9_-` as `_`, as Claude Code writes it in a
 *  tool name. */
const sanitize = (text: string) => text.replaceAll(/[^A-Za-z0-9_-]/g, '_')

const SKILL_FIELDS = ['allowed-tools', 'disallowed-tools']
const AGENT_FIELDS = ['tools', 'disallowedTools']

const rule: MarkdownRuleDefinition<{ MessageIds: 'bare' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Name a tool of a plugin MCP server with the scoped name of the plugin',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      bare: 'The tool name "{{tool}}" names the server "{{server}}" of this plugin without its scope. Claude Code names the tools of a plugin server "{{scoped}}", so the bare name matches no tool. Write "{{scoped}}".',
    },
  },
  create(context) {
    const skill = classifySkillFile(context.filename)
    const agent = skill === null ? classifyAgentFile(context.filename) : null
    // The plugin root, and the fields of the file that hold tool names.
    const scope =
      skill?.plugin === true
        ? {
            root: scopeRoot(context.filename, skill),
            fields: SKILL_FIELDS,
            separator: SPACE_OR_COMMA,
          }
        : agent?.plugin === true
          ? { root: agent.root, fields: AGENT_FIELDS, separator: COMMA }
          : null
    if (scope === null) {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        if (fm === null) {
          return
        }
        const entries = scope.fields.flatMap((key) =>
          listEntries(fm, node.value, key, scope.separator),
        )
        const tools = entries.flatMap(({ text, loc }) => {
          const parsed = parsePermissionRule(text)
          return parsed.ok && parsed.tool.startsWith(MCP_PREFIX) ? [{ tool: parsed.tool, loc }] : []
        })
        if (tools.length === 0) {
          return
        }
        const manifest = readJsonBody(
          path.join(scope.root, '.claude-plugin', 'plugin.json'),
          repositoryRoot(scope.root),
        )
        if (manifest === null) {
          return
        }
        const plugin = lastMember(manifest, 'name')?.value
        if (plugin?.type !== 'String') {
          return
        }
        // Each server by its name as written and by its name with `_`. A server with an empty
        // name has no tool name to match.
        const forms = pluginMcpDeclarations(scope.root, manifest).flatMap(({ name: server }) =>
          [server, sanitize(server)]
            .filter((form) => form !== '')
            .map((form) => ({ server, form })),
        )
        for (const { tool, loc } of tools) {
          const rest = tool.slice(MCP_PREFIX.length)
          const found = forms.find(
            ({ form }) => rest === form || rest.startsWith(`${form}${MCP_SEPARATOR}`),
          )
          if (found !== undefined) {
            const scoped = `${MCP_PREFIX}plugin_${sanitize(plugin.value)}_${sanitize(found.server)}${rest.slice(found.form.length)}`
            context.report({
              loc,
              messageId: 'bare',
              data: { tool, server: found.server, scoped },
            })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/SKILL.md', '**/commands/**/*.md', '**/agents/**/*.md'],
  rule,
}
