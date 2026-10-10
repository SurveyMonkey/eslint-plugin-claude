// The docs advise a phrase such as "use proactively" in the `description` of a subagent, to
// encourage delegation (docs/rules/agent-description-proactive.md). The rule is a heuristic: it
// looks for the word, and cannot tell if an agent is meant for explicit use only.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { docsUrl } from '../docs-url.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'agent-description-proactive' as const

// The word of the documented phrase, in any letter case.
const PROACTIVE = /\bproactively\b/i

const rule: MarkdownRuleDefinition<{ MessageIds: 'missing' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Put a phrase such as "use proactively" in the description of a subagent',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      missing:
        'The description has no phrase such as "use proactively". Claude Code delegates by the description, and the docs advise this phrase to encourage delegation. Ignore this report if you start the agent by hand only.',
    },
  },
  create(context) {
    if (classifyAgentFile(context.filename) === null) {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const field = fm?.fields.get('description')
        const text = fm?.data.description
        // A description that is absent, empty or not a string is a fault for another rule.
        if (
          fm === null ||
          field === undefined ||
          typeof text !== 'string' ||
          text.trim() === '' ||
          PROACTIVE.test(text)
        ) {
          return
        }
        context.report({ loc: fm.at(field.valueStart, field.valueEnd), messageId: 'missing' })
      },
    }
  },
}

export default { name, language: 'markdown' as const, files: ['**/*.md'], rule }
