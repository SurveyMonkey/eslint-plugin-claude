// A permission rule names a tool by its canonical name, and the name is
// case-sensitive. A rule for any other name never matches a tool
// (docs/rules/permissions-unknown-tool.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { OTHER_RULE_TOOL_NAMES, TOOL_NAMES } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { parsedEntries } from '../permission-entries.ts'

const name = 'permissions-unknown-tool' as const

type Options = [{ additionalTools: string[] }]

const rule: JSONRuleDefinition<{
  RuleOptions: Options
  MessageIds: 'unknown' | 'wrongCase'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Name a tool that Claude Code knows in a permission rule',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          additionalTools: { type: 'array', items: { type: 'string' }, uniqueItems: true },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ additionalTools: [] }],
    messages: {
      unknown: 'Claude Code has no tool named "{{tool}}", so this rule never matches.',
      wrongCase:
        'Claude Code has no tool named "{{tool}}", so this rule never matches. Did you mean "{{known}}"?',
    },
  },
  create(context) {
    const known = [...TOOL_NAMES, ...OTHER_RULE_TOOL_NAMES, ...context.options[0].additionalTools]
    return {
      Document(node) {
        for (const { node: entry, rule: parsed } of parsedEntries(node)) {
          const { tool } = parsed
          // The docs exempt a name with `_` or `*` from the check. This
          // covers each `mcp__` name and each glob.
          if (known.includes(tool) || tool.includes('_') || tool.includes('*')) {
            continue
          }
          const match = known.find((candidate) => candidate.toLowerCase() === tool.toLowerCase())
          if (match === undefined) {
            context.report({ node: entry, messageId: 'unknown', data: { tool } })
          } else {
            context.report({ node: entry, messageId: 'wrongCase', data: { tool, known: match } })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude/settings.json', '**/.claude/settings.local.json'],
  rule,
}
