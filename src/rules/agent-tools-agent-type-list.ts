// The `Agent(type)` list in `tools` limits which subagents an agent can spawn, but only when the
// agent runs as the main thread. In a subagent run Claude Code ignores the list
// (docs/rules/agent-tools-agent-type-list.md). The `agent` setting makes an agent the main thread.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { mainAgentNames, projectAgentNames } from '../agent-project.ts'
import { BUILT_IN_AGENTS } from '../data/agent-fields.ts'
import { docsUrl } from '../docs-url.ts'
import { COMMA, listEntries } from '../frontmatter-list.ts'
import { parsePermissionRule } from '../permission-rule.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import { UNREADABLE } from '../skill-tree.ts'

const name = 'agent-tools-agent-type-list' as const

type Options = [{ allow: string[] }]

/** The tools whose parentheses hold a list of agent types. `Task` is the old name of `Agent`. */
const TYPE_LIST_TOOLS = ['Agent', 'Task']

const rule: MarkdownRuleDefinition<{
  RuleOptions: Options
  MessageIds: 'ignored' | 'unknownType'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use an Agent(type) list only in an agent that runs as the main thread',
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
      ignored:
        'Claude Code applies an `Agent(type)` list only when the agent runs as the main thread. No committed `agent` setting names `{{name}}`, and the rule cannot see the `--agent` flag. In a subagent run, Claude Code ignores the list. Name the agent in the option `allow` if you start it with the flag.',
      unknownType:
        'The `Agent` list names {{types}}. No built-in agent and no file in `.claude/agents/` defines {{types}}, so this agent cannot spawn it. Name an agent from outside the repository in the option `allow`.',
    },
  },
  create(context) {
    const scope = classifyAgentFile(context.filename)
    if (scope === null || scope.plugin) {
      return {}
    }
    const [{ allow }] = context.options
    const allowed = new Set(allow.map((item) => item.toLowerCase()))
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        if (fm === null) {
          return
        }
        const agentName = fm.data.name
        const lists = listEntries(fm, node.value, 'tools', COMMA).flatMap(({ text, loc }) => {
          const parsed = parsePermissionRule(text)
          const types =
            parsed.ok && TYPE_LIST_TOOLS.includes(parsed.tool)
              ? (parsed.specifier ?? '')
                  .split(',')
                  .map((type) => type.trim())
                  .filter((type) => type !== '')
              : []
          return types.length === 0 ? [] : [{ types, loc }]
        })
        // A name that is not a string, or is empty, is no name to compare with the setting.
        if (lists.length === 0 || typeof agentName !== 'string' || agentName === '') {
          return
        }
        const mains = mainAgentNames(scope)
        if (mains === UNREADABLE) {
          return
        }
        if (!mains.includes(agentName)) {
          if (!allow.includes(agentName)) {
            for (const { loc } of lists) {
              context.report({ loc, messageId: 'ignored', data: { name: agentName } })
            }
          }
          return
        }
        const defined = projectAgentNames(scope)
        if (defined === UNREADABLE) {
          return
        }
        // The docs do not say if Claude Code compares a type with case, so the rule ignores it.
        const known = new Set([...BUILT_IN_AGENTS, ...defined].map((type) => type.toLowerCase()))
        for (const { types, loc } of lists) {
          // A scoped type, with a `:`, names the agent of a plugin that the rule cannot see.
          const unknown = types.filter(
            (type) =>
              !type.includes(':') &&
              !known.has(type.toLowerCase()) &&
              !allowed.has(type.toLowerCase()),
          )
          if (unknown.length > 0) {
            context.report({
              loc,
              messageId: 'unknownType',
              data: { types: unknown.map((type) => `\`${type}\``).join(', ') },
            })
          }
        }
      },
    }
  },
}

export default { name, language: 'markdown' as const, files: ['**/agents/**/*.md'], rule }
