// The `hooks` of a marketplace entry must be an inline object. Claude Code
// never runs a path or an array there
// (docs/rules/marketplace-entry-hooks-inline.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'

const name = 'marketplace-entry-hooks-inline' as const

const rule: JSONRuleDefinition<{ MessageIds: 'string' | 'array' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write the hooks of a marketplace entry as an inline object',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      string:
        'The entry sets "hooks" as a string, and Claude Code never runs these hooks. Write an inline object of event names and matcher arrays.',
      array:
        'The entry sets "hooks" as an array, and Claude Code never runs these hooks. Write an inline object of event names and matcher arrays.',
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
