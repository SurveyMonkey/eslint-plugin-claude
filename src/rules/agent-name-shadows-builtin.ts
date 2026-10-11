// A project or user subagent with the name of a built-in subagent replaces
// the built-in (docs/rules/agent-name-shadows-builtin.md). A plugin agent has a
// scoped name, so it cannot shadow a built-in, and the rule checks only files
// in `.claude/agents/`.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { BUILT_IN_AGENTS } from '../data/agent-fields.ts'
import { docsUrl } from '../docs-url.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'agent-name-shadows-builtin' as const

type Options = [{ allow: string[] }]

const rule: MarkdownRuleDefinition<{ RuleOptions: Options; MessageIds: 'shadows' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not give a local subagent the name of a built-in subagent',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          allow: { type: 'array', items: { type: 'string' }, uniqueItems: true },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allow: [] }],
    messages: {
      shadows:
        'The name `{{name}}` is the name of a built-in subagent. This agent replaces the built-in. If you intend that, add the name to the `allow` option.',
    },
  },
  create(context) {
    if (classifyAgentFile(context.filename)?.plugin !== false) {
      return {}
    }
    const [{ allow }] = context.options
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const field = fm?.fields.get('name')
        if (fm === null || field === undefined) {
          return
        }
        const value = fm.data.name
        if (
          typeof value === 'string' &&
          (BUILT_IN_AGENTS as readonly string[]).includes(value) &&
          !allow.includes(value)
        ) {
          context.report({
            loc: fm.at(field.valueStart, field.valueEnd),
            messageId: 'shadows',
            data: { name: value },
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
