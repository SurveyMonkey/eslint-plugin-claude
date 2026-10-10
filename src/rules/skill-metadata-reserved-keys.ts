// A key inside `metadata` must not reuse the name of a frontmatter field
// (docs/rules/skill-metadata-reserved-keys.md). Claude Code does not read
// `metadata`, so the rule does not claim an effect.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { COMMAND_EXCLUDED, SKILL_FIELDS } from '../data/skill-fields.ts'
import { docsUrl } from '../docs-url.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'skill-metadata-reserved-keys' as const

const rule: MarkdownRuleDefinition<{ MessageIds: 'reserved' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not reuse a frontmatter field name as a metadata key',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      reserved:
        '`metadata` has {{keys}}. The docs say not to reuse a frontmatter field name as a key.',
    },
  },
  create(context) {
    const file = classifySkillFile(context.filename)
    if (file === null) {
      return {}
    }
    // A command file in `.claude/commands/` has no `name` or `paths` field (as in the schema rule).
    const restricted = file.kind === 'command' && !file.plugin
    const reserved: string[] = restricted
      ? SKILL_FIELDS.filter((f) => !COMMAND_EXCLUDED.includes(f))
      : [...SKILL_FIELDS]
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const field = fm?.fields.get('metadata')
        const value = fm?.data.metadata
        // A value that is not a map is a fault of the schema rule.
        if (
          fm === null ||
          field === undefined ||
          typeof value !== 'object' ||
          value === null ||
          Array.isArray(value)
        ) {
          return
        }
        const keys = Object.keys(value).filter((key) => reserved.includes(key))
        if (keys.length > 0) {
          context.report({
            loc: fm.at(field.valueStart, field.valueEnd),
            messageId: 'reserved',
            data: { keys: keys.map((key) => `\`${key}\``).join(', ') },
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
