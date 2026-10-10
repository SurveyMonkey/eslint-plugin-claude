// A skill or command whose name is the name of a built-in command or a bundled
// skill (docs/rules/skill-name-shadows-builtin.md). A plugin skill has a
// namespace, so the rule checks files outside a plugin only.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { BUILT_IN_COMMANDS, BUNDLED_SKILLS } from '../data/command-names.ts'
import { docsUrl } from '../docs-url.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter, type SkillFrontmatter } from '../skill-frontmatter.ts'

const name = 'skill-name-shadows-builtin' as const

type Options = [{ allow: string[] }]

const rule: MarkdownRuleDefinition<{
  RuleOptions: Options
  MessageIds: 'builtIn' | 'bundled'
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
    },
  },
  create(context) {
    const [{ allow }] = context.options
    const file = classifySkillFile(context.filename)
    // A plugin skill has the namespace `plugin:name`, so it never takes the bare name.
    if (file === null || file.plugin) {
      return {}
    }
    /** Report `given` at `loc` when it is the name of a command that Claude Code owns. */
    function check(given: string, loc: ReturnType<SkillFrontmatter['at']>) {
      if (allow.includes(given)) {
        return
      }
      const messageId = BUILT_IN_COMMANDS.includes(given)
        ? 'builtIn'
        : BUNDLED_SKILLS.includes(given)
          ? 'bundled'
          : null
      if (messageId !== null) {
        context.report({ loc, messageId, data: { name: given } })
      }
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
        if (fm && field && typeof given === 'string' && given !== '') {
          check(given, fm.at(field.valueStart, field.valueEnd))
          return
        }
        // With no `name`, the skill folder gives the name. The name of a command file is its
        // path below `commands/`, with `:` between the parts.
        const start = { line: 1, column: 1 }
        check(file.names.join(':'), { start, end: start })
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
