// A skill with `disable-model-invocation: true` and `user-invocable: false`
// has no caller (docs/rules/skill-invocation-unreachable.md).
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'skill-invocation-unreachable' as const

/** The boolean that Claude Code reads from `value`: `true`, `false`, or one
 *  of `yes`, `no`, `on`, `off`, `1` and `0` in any letter case. Null for
 *  any other value, and for a list or a map. */
function readBoolean(value: unknown): boolean | null {
  if (!['boolean', 'number', 'string'].includes(typeof value)) {
    return null
  }
  const text = String(value).toLowerCase()
  if (['true', 'yes', 'on', '1'].includes(text)) {
    return true
  }
  return ['false', 'no', 'off', '0'].includes(text) ? false : null
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'unreachable' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Let the user or Claude invoke a skill',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unreachable:
        '`disable-model-invocation: true` blocks Claude, and `user-invocable: false` blocks the user. No one can invoke this skill.',
    },
  },
  create(context) {
    if (classifySkillFile(context.filename)?.kind !== 'skill') {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const field = fm?.fields.get('disable-model-invocation')
        if (
          fm === null ||
          field === undefined ||
          readBoolean(fm.data['disable-model-invocation']) !== true ||
          readBoolean(fm.data['user-invocable']) !== false
        ) {
          return
        }
        context.report({ loc: fm.at(field.keyStart, field.valueEnd), messageId: 'unreachable' })
      },
    }
  },
}

export default { name, language: 'markdown' as const, files: ['**/SKILL.md'], rule }
