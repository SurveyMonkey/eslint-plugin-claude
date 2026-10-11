// Two `tools` lists lose their entries in some runs of the subagent
// (docs/rules/agent-tools-conditional.md). A built-in tool outside the
// background set is gone when the subagent runs in the background, which is
// the default. The tool `Agent` is gone at the depth limit.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { BACKGROUND_TOOL_NAMES, SUBAGENT_REMOVED_TOOLS, TOOL_NAMES } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { readBoolean } from '../frontmatter-boolean.ts'
import { COMMA, listEntries } from '../frontmatter-list.ts'
import { parsePermissionRule } from '../permission-rule.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'agent-tools-conditional' as const

// `Task` is the old name of `Agent`.
const AGENT_TOOLS = ['Agent', 'Task']

const rule: MarkdownRuleDefinition<{ MessageIds: 'background' | 'onlyAgent' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not list in tools a tool that a background or nested subagent loses',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      background:
        'Claude Code removes {{tool}} from a subagent that runs in the background, and that is the default run mode. `background` is not `true` here. The subagent has the tool only in a foreground run.',
      onlyAgent:
        '`tools` lists only `Agent`. Claude Code withholds `Agent` from a subagent at the depth limit, and the list then resolves to no tool. Claude Code usually refuses to launch such a subagent. Add another tool.',
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
        const entries = listEntries(fm, node.value, 'tools', COMMA).map((entry) => ({
          ...entry,
          parsed: parsePermissionRule(entry.text),
        }))
        // A value that is no Boolean at all is for `agent-frontmatter-schema`.
        const { background } = fm.data
        const notBackground =
          background === undefined || background === null || readBoolean(background) === false
        for (const { loc, parsed } of entries) {
          if (
            notBackground &&
            parsed.ok &&
            TOOL_NAMES.includes(parsed.tool) &&
            !BACKGROUND_TOOL_NAMES.includes(parsed.tool) &&
            // `agent-tools-unavailable` reports the tools that no subagent keeps.
            !SUBAGENT_REMOVED_TOOLS.includes(parsed.tool)
          ) {
            context.report({ loc, messageId: 'background', data: { tool: parsed.tool } })
          }
        }
        const [first] = entries
        if (
          first !== undefined &&
          entries.every(({ parsed }) => parsed.ok && AGENT_TOOLS.includes(parsed.tool))
        ) {
          context.report({ loc: first.loc, messageId: 'onlyAgent' })
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
