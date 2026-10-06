// Stub: reports nothing.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'

const name = 'agent-skills-preloadable' as const

const rule: MarkdownRuleDefinition<{ MessageIds: 'disabled' | 'bundled' }> = {
  meta: {
    type: 'problem',
    docs: { description: 'Preload only skills that a model can invoke', url: docsUrl(name) },
    schema: [],
    messages: { disabled: 'Disabled.', bundled: 'Bundled.' },
  },
  create() {
    return {}
  },
}

export default { name, language: 'markdown' as const, files: ['**/agents/**/*.md'], rule }
