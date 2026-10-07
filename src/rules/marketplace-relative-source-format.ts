// The text of a relative plugin source in a marketplace entry, and of
// `metadata.pluginRoot`. The rule reads the text only. It reads no file
// system (docs/rules/marketplace-relative-source-format.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'

const name = 'marketplace-relative-source-format' as const

const rule: JSONRuleDefinition<{ MessageIds: 'network' | 'absolute' | 'parent' | 'noPrefix' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write a relative plugin source as the docs require',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      network:
        'The {{field}} "{{path}}" starts with two slashes or two backslashes, a network path. Write a path inside the marketplace.',
      absolute:
        'The {{field}} "{{path}}" is an absolute path. Write a path inside the marketplace, from the marketplace root.',
      parent: 'The {{field}} "{{path}}" contains "..". The path must stay inside the marketplace.',
      noPrefix:
        'The "source" "{{path}}" does not start with "./". A relative path starts with "./", and a bare name needs "metadata.pluginRoot".',
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
