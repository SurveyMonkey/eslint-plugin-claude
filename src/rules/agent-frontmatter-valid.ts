// Claude Code skips a local subagent file with bad frontmatter, with no error
// (docs/rules/agent-frontmatter-valid.md). A plugin agent with no name or
// bad YAML still loads, and the docs say no more, so the rule checks only
// files in `.claude/agents/`. Claude Code also skips a file whose `name` has
// more than 256 characters. The option `nameMax` sets a lower limit.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { AGENT_FIELDS } from '../data/agent-fields.ts'
import { docsUrl } from '../docs-url.ts'
import { lateFrontmatter } from '../late-frontmatter.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'agent-frontmatter-valid' as const

// The documented limit on a `name`, and the default of `nameMax`.
const NAME_LIMIT = 256

type Options = [{ nameMax: number }]

/** True when a required field has no usable value. A value that is not a
 *  string is a fault for `agent-frontmatter-schema`. */
function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
}

const rule: MarkdownRuleDefinition<{
  RuleOptions: Options
  MessageIds:
    | 'notFirst'
    | 'invalidYaml'
    | 'missingName'
    | 'missingDescription'
    | 'badName'
    | 'nameTooLong'
    | 'nameOverConfiguredLimit'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Give a local subagent file frontmatter that Claude Code can load',
      url: docsUrl(name),
    },
    // No setting of Claude Code moves the limit of 256, so the schema sets it as the maximum.
    schema: [
      {
        type: 'object',
        properties: {
          nameMax: { type: 'integer', minimum: 1, maximum: NAME_LIMIT },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ nameMax: NAME_LIMIT }],
    messages: {
      notFirst:
        'This frontmatter block does not start on line 1. Claude Code reads the file as documentation, and does not load the agent.',
      invalidYaml:
        'The frontmatter is not YAML that gives a map of fields. Claude Code skips this agent file.',
      missingName: 'The frontmatter has no `name`. Claude Code reads the file as documentation.',
      missingDescription:
        'The frontmatter has no `description`. Claude Code skips this agent file.',
      badName:
        '`name` must not start with `-` and must not contain `:`. Claude Code skips this agent file.',
      nameTooLong:
        '`name` has {{length}} characters. Claude Code skips an agent file with a `name` of more than {{max}}.',
      nameOverConfiguredLimit: '`name` has {{length}} characters. The configured limit is {{max}}.',
    },
  },
  create(context) {
    // A plugin agent still loads, and a file outside the agent folders is no agent.
    if (classifyAgentFile(context.filename)?.plugin !== false) {
      return {}
    }
    const { sourceCode } = context
    const [{ nameMax }] = context.options
    return {
      root() {
        const opening = lateFrontmatter(sourceCode, AGENT_FIELDS)
        if (opening !== null) {
          context.report({
            loc: {
              start: { line: opening.line, column: 1 },
              end: { line: opening.line, column: opening.text.length + 1 },
            },
            messageId: 'notFirst',
          })
        }
      },
      yaml(node) {
        if (node.value.trim() === '') {
          context.report({ node, messageId: 'missingName' })
          context.report({ node, messageId: 'missingDescription' })
          return
        }
        const fm = readFrontmatter(sourceCode, node)
        if (fm === null) {
          context.report({ node, messageId: 'invalidYaml' })
          return
        }
        const agentName = fm.data.name
        if (isBlank(agentName)) {
          context.report({ node, messageId: 'missingName' })
        } else if (
          typeof agentName === 'string' &&
          (agentName.startsWith('-') || agentName.includes(':'))
        ) {
          // The field exists, because the name is not blank.
          const field = fm.fields.get('name') as { valueStart: number; valueEnd: number }
          context.report({ loc: fm.at(field.valueStart, field.valueEnd), messageId: 'badName' })
        }
        if (typeof agentName === 'string') {
          // The docs say "characters". A code point counts once, so the rule never over-counts.
          const length = [...agentName].length
          if (length > nameMax) {
            const field = fm.fields.get('name') as { valueStart: number; valueEnd: number }
            context.report({
              loc: fm.at(field.valueStart, field.valueEnd),
              // At another value, the message names the configured limit and claims no skip.
              messageId: nameMax === NAME_LIMIT ? 'nameTooLong' : 'nameOverConfiguredLimit',
              data: { length: String(length), max: String(nameMax) },
            })
          }
        }
        if (isBlank(fm.data.description)) {
          context.report({ node, messageId: 'missingDescription' })
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
