// The `model` of a subagent is an alias, `inherit`, or a full model ID
// (docs/rules/agent-model-value.md). The aliases and the ID forms are in `src/data/models.ts`.
// `agent-frontmatter-schema` reports a `model` that is not a string, or is empty.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { hasProviderForm, isModelAlias, isModelId } from '../data/models.ts'
import { docsUrl } from '../docs-url.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'agent-model-value' as const

type Options = [{ allow: string[] }]

/** The value that selects the model of the main conversation. */
const INHERIT = 'inherit'

const rule: MarkdownRuleDefinition<{ RuleOptions: Options; MessageIds: 'unknown' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Set the model of a subagent to an alias, inherit, or a model ID',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { allow: { type: 'array', items: { type: 'string' }, uniqueItems: true } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allow: [] }],
    messages: {
      unknown:
        '`{{value}}` is not a model alias, `inherit`, or a `claude-` model ID. A provider or a gateway can accept other values. Name such a value in the option `allow`.',
    },
  },
  create(context) {
    if (classifyAgentFile(context.filename) === null) {
      return {}
    }
    const [{ allow }] = context.options
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const field = fm?.fields.get('model')
        const value = fm?.data.model
        // A value that is not a string, or is empty, is the business of `agent-frontmatter-schema`.
        if (
          fm === null ||
          field === undefined ||
          typeof value !== 'string' ||
          value.trim() === ''
        ) {
          return
        }
        // The docs do not say if Claude Code compares an alias with case, so the rule ignores it.
        const lower = value.toLowerCase()
        if (
          lower === INHERIT ||
          isModelAlias(lower) ||
          isModelId(value) ||
          hasProviderForm(value) ||
          allow.includes(value)
        ) {
          return
        }
        context.report({
          loc: fm.at(field.valueStart, field.valueEnd),
          messageId: 'unknown',
          data: { value },
        })
      },
    }
  },
}

export default { name, language: 'markdown' as const, files: ['**/agents/**/*.md'], rule }
