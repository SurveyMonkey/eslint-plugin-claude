// Claude Code reads `yes`, `no`, `on`, `off`, `1` and `0` in a Boolean field
// from v2.1.218. Before that, it reads only `true` and `false`
// (docs/rules/skill-boolean-literal.md).
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { SKILL_BOOLEAN_FIELDS } from '../data/skill-fields.ts'
import { docsUrl } from '../docs-url.ts'
import { readBoolean } from '../frontmatter-boolean.ts'
import { MIN_VERSION_SCHEMA, supportsBefore } from '../min-version.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'skill-boolean-literal' as const

// The first version that reads the other Boolean forms.
const FIXED = '2.1.218'

type Options = [{ minVersion?: string }]

const rule: MarkdownRuleDefinition<{ RuleOptions: Options; MessageIds: 'nonLiteral' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write a Boolean field of a skill as true or false',
      url: docsUrl(name),
    },
    schema: [MIN_VERSION_SCHEMA],
    defaultOptions: [{}],
    messages: {
      nonLiteral:
        '`{{key}}` is set to `{{value}}`, not `true` or `false`. Claude Code before v2.1.218 reads only `true` and `false`.',
    },
  },
  create(context) {
    const [{ minVersion }] = context.options
    if (classifySkillFile(context.filename) === null || !supportsBefore(minVersion, FIXED)) {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        if (fm === null) {
          return
        }
        for (const key of SKILL_BOOLEAN_FIELDS) {
          const field = fm.fields.get(key)
          const value = fm.data[key]
          // YAML reads `true`, `True` and `TRUE` as a Boolean, and so does every version.
          if (field === undefined || typeof value === 'boolean' || readBoolean(value) === null) {
            continue
          }
          context.report({
            loc: fm.at(field.valueStart, field.valueEnd),
            messageId: 'nonLiteral',
            data: { key, value: node.value.slice(field.valueStart, field.valueEnd) },
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
