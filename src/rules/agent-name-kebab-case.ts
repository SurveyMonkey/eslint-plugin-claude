// The `name` of every example in the docs is kebab-case, such as `code-reviewer` or
// `reviewer-v2` (docs/rules/agent-name-kebab-case.md). The docs do not require it, and the file
// name need not match. The rule is a heuristic of style.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { BUILT_IN_AGENTS } from '../data/agent-fields.ts'
import { docsUrl } from '../docs-url.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'agent-name-kebab-case' as const

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/

const rule: MarkdownRuleDefinition<{ MessageIds: 'notKebab' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Write the name of a subagent in kebab-case, as the docs examples do',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      notKebab:
        '`{{name}}` is not kebab-case. Every example in the docs is lowercase words, digits and single hyphens, such as `code-reviewer`.',
    },
  },
  create(context) {
    if (classifyAgentFile(context.filename) === null) {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const field = fm?.fields.get('name')
        const agentName = fm?.data.name
        // A name that is absent, empty or not a string is a fault for another rule. A built-in
        // name is the case of `agent-name-shadows-builtin`.
        if (
          fm === null ||
          field === undefined ||
          typeof agentName !== 'string' ||
          agentName === '' ||
          KEBAB.test(agentName) ||
          (BUILT_IN_AGENTS as readonly string[]).includes(agentName)
        ) {
          return
        }
        context.report({
          loc: fm.at(field.valueStart, field.valueEnd),
          messageId: 'notKebab',
          data: { name: agentName },
        })
      },
    }
  },
}

export default { name, language: 'markdown' as const, files: ['**/*.md'], rule }
