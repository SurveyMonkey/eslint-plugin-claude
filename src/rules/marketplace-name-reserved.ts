// Claude Code refuses a marketplace name that it reserves
// (docs/rules/marketplace-name-reserved.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'

const name = 'marketplace-name-reserved' as const

type Options = [{ allowOfficial: boolean }]
type MessageIds = 'official' | 'spelling' | 'internal' | 'packageManager' | 'claudeaiPrefix'

const rule: JSONRuleDefinition<{ RuleOptions: Options; MessageIds: MessageIds }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not give a marketplace a name that Claude Code reserves',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { allowOfficial: { type: 'boolean' } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allowOfficial: false }],
    messages: {
      official:
        'The marketplace name "{{name}}" is reserved for Anthropic marketplaces. Claude Code accepts it only for a source under github.com/anthropics/.',
      spelling:
        'The marketplace name "{{name}}" is another spelling of "{{reserved}}", a reserved name. Claude Code refuses it.',
      internal: 'The marketplace name "{{name}}" is a reserved name. Claude Code refuses it.',
      packageManager:
        'The marketplace name "{{name}}" is a package-manager name. Claude Code reserves it in any letter case.',
      claudeaiPrefix:
        'The marketplace name "{{name}}" starts with "claudeai-". Claude Code reserves that prefix for marketplaces that claude.ai hosts.',
    },
  },
  create() {
    return {}
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/marketplace.json'],
  rule,
}
