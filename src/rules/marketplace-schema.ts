// The top-level fields, the `owner`, and the entries of `marketplace.json`:
// the fields that the docs require, and the type of each field that the docs
// list (docs/rules/marketplace-schema.md). This rule reports a value of the
// wrong type for each field that another `marketplace-*` rule reads, and no
// other rule does.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'

const name = 'marketplace-schema' as const

type MessageIds =
  | 'notObject'
  | 'missing'
  | 'empty'
  | 'wrongType'
  | 'notStringElement'
  | 'renamesValue'
  | 'entryNotObject'

const rule: JSONRuleDefinition<{ MessageIds: MessageIds }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write the fields of marketplace.json as the docs require',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      notObject: 'The marketplace file must be a JSON object.',
      missing: 'The {{where}} needs "{{key}}".',
      empty: 'The "{{path}}" must not be empty.',
      wrongType: 'The "{{path}}" must be {{expected}}.',
      notStringElement: 'The "{{path}}" must hold strings only.',
      renamesValue:
        'Each value in "renames" must be a string, or null for a plugin that you removed.',
      entryNotObject: 'Each item in "plugins" must be an object.',
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
