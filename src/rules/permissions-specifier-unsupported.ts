// A tool that takes no specifier accepts its bare name only. A deny or ask
// rule can still match a parameter with `Tool(param:value)`
// (docs/rules/permissions-specifier-unsupported.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { SPECIFIER_TOOLS, TOOL_NAMES } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { parameterOf, parsedEntries } from '../permission-entries.ts'

const name = 'permissions-specifier-unsupported' as const

const SPECIFIER_SET = new Set(SPECIFIER_TOOLS)
const BARE_ONLY = new Set(TOOL_NAMES.filter((tool) => !SPECIFIER_SET.has(tool)))

const rule: JSONRuleDefinition<{ MessageIds: 'unsupported' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write a tool that takes no specifier as its bare name',
      url: docsUrl(name),
    },
    messages: {
      unsupported:
        '{{tool}} takes the bare tool name only, so this rule does not match as written.',
    },
  },
  create(context) {
    return {
      Document(node) {
        for (const entry of parsedEntries(node)) {
          const { tool, specifier } = entry.rule
          if (BARE_ONLY.has(tool) && specifier !== null && parameterOf(entry) === null) {
            context.report({ node: entry.node, messageId: 'unsupported', data: { tool } })
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
