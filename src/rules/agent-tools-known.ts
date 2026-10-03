// `tools` and `disallowedTools` in a subagent file list tool names. Claude
// Code drops an entry that names no tool, and it refuses to launch a subagent
// whose `tools` list resolves to nothing (docs/rules/agent-tools-known.md).
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { MCP_PREFIX, OTHER_RULE_TOOL_NAMES, TOOL_NAMES } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { COMMA, listEntries } from '../frontmatter-list.ts'
import { parsePermissionRule } from '../permission-rule.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'agent-tools-known' as const

const KNOWN = new Set([...TOOL_NAMES, ...OTHER_RULE_TOOL_NAMES])

/** The tools whose parentheses hold a list of subagent types. `Task` is the
 *  old name of `Agent`. */
const TYPE_LIST_TOOLS = ['Agent', 'Task']

/** The server-wide pattern that only `disallowedTools` accepts. */
const ANY_MCP = `${MCP_PREFIX}*`

const rule: MarkdownRuleDefinition<{
  MessageIds: 'malformed' | 'unknown' | 'specifier' | 'anyMcp'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Name a tool that Claude Code knows in the tools of a subagent',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      malformed:
        '`{{entry}}` is not a tool name or a rule of the form Tool(specifier). Claude Code does not resolve it.',
      unknown: 'Claude Code has no tool named "{{tool}}", so it does not resolve this entry.',
      specifier:
        '`tools` takes a tool name only. Only `Agent(type)` takes parentheses here. A specifier such as `{{entry}}` is for `disallowedTools`.',
      anyMcp:
        '`mcp__*` is for `disallowedTools`. Name a server, as in `mcp__<server>`, in `tools`.',
    },
  },
  create(context) {
    if (classifyAgentFile(context.filename) === null) {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        if (fm === null) {
          return
        }
        for (const key of ['tools', 'disallowedTools']) {
          for (const { text, loc } of listEntries(fm, node.value, key, COMMA)) {
            const parsed = parsePermissionRule(text)
            if (!parsed.ok) {
              context.report({ loc, messageId: 'malformed', data: { entry: text } })
              continue
            }
            const { tool, specifier } = parsed
            if (tool.startsWith(MCP_PREFIX)) {
              if (tool === ANY_MCP && key === 'tools') {
                context.report({ loc, messageId: 'anyMcp' })
              } else if (specifier !== null && key === 'tools') {
                context.report({ loc, messageId: 'specifier', data: { entry: text } })
              }
            } else if (!KNOWN.has(tool)) {
              context.report({ loc, messageId: 'unknown', data: { tool } })
            } else if (specifier !== null && key === 'tools' && !TYPE_LIST_TOOLS.includes(tool)) {
              context.report({ loc, messageId: 'specifier', data: { entry: text } })
            }
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/agents/**/*.md'],
  rule,
}
