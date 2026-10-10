// A skill or command whose name is the name of a built-in command or a bundled
// skill (docs/rules/skill-name-shadows-builtin.md). A plugin skill has a
// namespace, so the rule checks files outside a plugin only.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { BUILT_IN_COMMANDS, BUNDLED_SKILLS } from '../data/command-names.ts'
import { docsUrl } from '../docs-url.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'skill-name-shadows-builtin' as const

type Options = [{ allow: string[] }]

const rule: MarkdownRuleDefinition<{
  RuleOptions: Options
  MessageIds: 'builtIn' | 'bundled' | 'notTaken'
}> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not give a skill the name of a built-in command or a bundled skill',
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
      builtIn:
        '`{{name}}` is the name of a built-in command. In a local terminal session, a skill with this name replaces the command, but not its aliases. Rename the skill, or add the name to the option `allow`.',
      bundled:
        '`{{name}}` is the name of a bundled skill. A skill with this name replaces the bundled skill, but not its aliases. Rename the skill, or add the name to the option `allow`.',
      notTaken:
        '`{{name}}` is the name of a command that Claude Code owns, so the field `name` does not take it. The folder name `{{folder}}` still invokes the skill. Use another name, or add the name to the option `allow`.',
    },
  },
  create(context) {
    const [{ allow }] = context.options
    const file = classifySkillFile(context.filename)
    // A plugin skill has the namespace `plugin:name`, so it cannot replace a built-in command.
    if (file === null || file.plugin) {
      return {}
    }
    /** The id of the message for `given`, or null when Claude Code does not own the name. */
    function ownerOf(given: string) {
      if (allow.includes(given)) {
        return null
      }
      if (BUILT_IN_COMMANDS.includes(given)) {
        return 'builtIn' as const
      }
      return BUNDLED_SKILLS.includes(given) ? ('bundled' as const) : null
    }
    return {
      root(node) {
        const first = node.children[0]
        const fm =
          file.kind === 'skill' && first?.type === 'yaml'
            ? readFrontmatter(context.sourceCode, first)
            : null
        const field = fm?.fields.get('name')
        const given = fm?.data.name
        const named = fm && field && typeof given === 'string' && given !== ''
        // The folder of a skill invokes it, and so does the path of a command file below
        // `commands/`, with `:` between the parts. Both replace a name that Claude Code owns.
        const own = file.names.join(':')
        const start = { line: 1, column: 1 }
        const ownLoc =
          named && given === own ? fm.at(field.valueStart, field.valueEnd) : { start, end: start }
        const messageId = ownerOf(own)
        if (messageId !== null) {
          context.report({ loc: ownLoc, messageId, data: { name: own } })
        }
        // A `name` field that is a name Claude Code owns does not take.
        if (named && given !== own && ownerOf(given) !== null) {
          context.report({
            loc: fm.at(field.valueStart, field.valueEnd),
            messageId: 'notTaken',
            data: { name: given, folder: own },
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/SKILL.md', '**/commands/**/*.md'],
  rule,
}
