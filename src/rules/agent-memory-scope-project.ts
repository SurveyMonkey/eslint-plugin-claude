// The sub-agents page names `project` as the recommended default scope of
// `memory` (docs/rules/agent-memory-scope-project.md). The rule applies to
// local and plugin agents, because both accept `memory`.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { docsUrl } from '../docs-url.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'agent-memory-scope-project' as const

const rule: MarkdownRuleDefinition<{ MessageIds: 'notProject' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer memory: project, the recommended scope, in a subagent',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      notProject:
        '`memory: {{scope}}` is not the recommended scope. `project` is the default that the docs recommend, because it makes the memory shareable through version control. Keep `{{scope}}` only if the memory must not be shared.',
    },
  },
  create(context) {
    if (classifyAgentFile(context.filename) === null) {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const field = fm?.fields.get('memory')
        const scope = fm?.data.memory
        if (fm !== null && field !== undefined && (scope === 'user' || scope === 'local')) {
          context.report({
            loc: fm.at(field.valueStart, field.valueEnd),
            messageId: 'notProject',
            data: { scope },
          })
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
