// Claude Code skips a local subagent file with bad frontmatter, with no error
// (docs/rules/agent-frontmatter-valid.md). A plugin agent with no name or
// bad YAML still loads, and the docs say no more, so the rule checks the
// other fields of files in `.claude/agents/` only. Claude Code also skips a
// local file whose `name` has more than 256 characters. It ignores that
// `name` in a plugin agent, and names the agent after its file. The option
// `nameMax` sets a lower limit.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyLinted } from '../agent-files.ts'
import { AGENT_FIELDS } from '../data/agent-fields.ts'
import { docsUrl } from '../docs-url.ts'
import { classifyFrontmatter } from '../frontmatter.ts'
import { lateFrontmatter } from '../late-frontmatter.ts'
import { readFrontmatter, type SkillFrontmatter } from '../skill-frontmatter.ts'

const name = 'agent-frontmatter-valid' as const

// The documented limit on a `name`, and the default of `nameMax`.
const NAME_LIMIT = 256

type Options = [{ nameMax: number }]

/** True when a required field has no usable value. A value that is not a
 *  string is a fault for `agent-frontmatter-schema`. */
function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
}

/** The message for a name over the limit. At another limit than the docs give, the message
 *  claims no skip and no ignored name. */
function nameMessage(nameMax: number, isPlugin: boolean) {
  if (nameMax !== NAME_LIMIT) {
    return 'nameOverConfiguredLimit'
  }
  return isPlugin ? 'pluginNameTooLong' : 'nameTooLong'
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
    | 'pluginNameTooLong'
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
          nameMax: {
            description: 'The most characters in the name of an agent.',
            type: 'integer',
            minimum: 1,
            maximum: NAME_LIMIT,
          },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ nameMax: NAME_LIMIT }],
    messages: {
      notFirst:
        'This frontmatter block does not start on line 1. Claude Code reads the file as documentation, and does not load the agent.',
      // A value that is not a map has no `name`. The docs say that Claude Code then skips the file.
      invalidYaml:
        'The frontmatter is YAML, but not a map of fields, so it sets no `name`. Claude Code skips this agent file.',
      missingName: 'The frontmatter has no `name`. Claude Code reads the file as documentation.',
      missingDescription:
        'The frontmatter has no `description`. Claude Code skips this agent file.',
      badName:
        '`name` must not start with `-` and must not contain `:`. Claude Code skips this agent file.',
      nameTooLong:
        '`name` has {{length}} characters. Claude Code skips an agent file with a `name` of more than {{max}}.',
      pluginNameTooLong:
        '`name` has {{length}} characters. Claude Code ignores a `name` of more than {{max}}, and names the agent after its file.',
      nameOverConfiguredLimit: '`name` has {{length}} characters. The configured limit is {{max}}.',
    },
  },
  create(context) {
    // A file outside the agent folders is no agent.
    const agent = classifyLinted(context)
    if (agent === null) {
      return {}
    }
    // A plugin agent still loads, so the rule checks the length of its `name` only.
    const isPlugin = agent.plugin
    const { sourceCode } = context
    const [{ nameMax }] = context.options
    return {
      root() {
        if (isPlugin) {
          return
        }
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
        const parsed = classifyFrontmatter(node.value)
        // YAML that the strict parser cannot read is for `frontmatter-yaml-portable`. Claude Code
        // can read some of it, so this rule claims no skip, and checks no field.
        if (parsed.kind === 'error') {
          return
        }
        if (isPlugin && parsed.kind === 'not-mapping') {
          return
        }
        // An empty block, a block of comments only, and a YAML null have no field.
        if (parsed.kind === 'not-mapping' && parsed.value === null) {
          context.report({ node, messageId: 'missingName' })
          context.report({ node, messageId: 'missingDescription' })
          return
        }
        if (parsed.kind === 'not-mapping') {
          context.report({ node, messageId: 'invalidYaml' })
          return
        }
        const fm = readFrontmatter(sourceCode, node) as SkillFrontmatter
        const agentName = fm.data.name
        if (!isPlugin && isBlank(agentName)) {
          context.report({ node, messageId: 'missingName' })
        } else if (
          !isPlugin &&
          typeof agentName === 'string' &&
          (agentName.startsWith('-') || agentName.includes(':'))
        ) {
          // The field exists, because the name is not blank.
          const field = fm.fields.get('name') as { valueStart: number; valueEnd: number }
          context.report({ loc: fm.at(field.valueStart, field.valueEnd), messageId: 'badName' })
        }
        if (typeof agentName === 'string') {
          // The docs do not say how Claude Code counts a character. The rule counts code points.
          const length = [...agentName].length
          if (length > nameMax) {
            const field = fm.fields.get('name') as { valueStart: number; valueEnd: number }
            context.report({
              loc: fm.at(field.valueStart, field.valueEnd),
              // At another value, the message names the configured limit and claims no skip.
              messageId: nameMessage(nameMax, isPlugin),
              data: { length: String(length), max: String(nameMax) },
            })
          }
        }
        if (!isPlugin && isBlank(fm.data.description)) {
          context.report({ node, messageId: 'missingDescription' })
        }
      },
    }
  },
}

export const target = {
  name,
  language: 'markdown' as const,
  files: ['**/*.md'],
}

export default rule
