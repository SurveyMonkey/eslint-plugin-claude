// A field that no caller can use (docs/rules/skill-invocation-redundant-fields.md):
// `when_to_use` on a skill that Claude cannot invoke, and `argument-hint` on a
// skill that the user cannot invoke.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { readBoolean } from '../frontmatter-boolean.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'skill-invocation-redundant-fields' as const

/** True when the field has a value that is not empty. An empty value is the
 *  same as an absent field. */
function isSet(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== ''
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'whenToUse' | 'argumentHint' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Remove a field that the invocation settings of a skill make useless',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      whenToUse:
        '`when_to_use` has no use with `disable-model-invocation: true`. The skill listing leaves out the description of the skill, and `when_to_use` is part of it.',
      argumentHint:
        '`argument-hint` has no use with `user-invocable: false`. Claude Code hides the skill from the `/` menu, so no autocomplete shows the hint.',
    },
  },
  create(context) {
    if (classifySkillFile(context.filename)?.kind !== 'skill') {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        if (fm === null) {
          return
        }
        const checks = [
          ['when_to_use', 'disable-model-invocation', true, 'whenToUse'],
          ['argument-hint', 'user-invocable', false, 'argumentHint'],
        ] as const
        for (const [key, setting, blocking, messageId] of checks) {
          const field = fm.fields.get(key)
          if (
            field !== undefined &&
            isSet(fm.data[key]) &&
            readBoolean(fm.data[setting]) === blocking
          ) {
            context.report({ loc: fm.at(field.keyStart, field.valueEnd), messageId })
          }
        }
      },
    }
  },
}

export default { name, language: 'markdown' as const, files: ['**/SKILL.md'], rule }
