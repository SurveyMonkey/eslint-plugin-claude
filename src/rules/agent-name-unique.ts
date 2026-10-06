// Stub: reports nothing.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'

const name = 'agent-name-unique' as const

const rule: MarkdownRuleDefinition<{ MessageIds: 'duplicate' }> = {
  meta: {
    type: 'problem',
    docs: { description: 'Give each local agent its own name', url: docsUrl(name) },
    schema: [],
    messages: { duplicate: 'Duplicate.' },
  },
  create() {
    return {}
  },
}

export default { name, language: 'markdown' as const, files: ['**/agents/**/*.md'], rule }
