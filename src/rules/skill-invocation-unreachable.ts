// A skill with `disable-model-invocation: true` and `user-invocable: false`
// has no direct caller (docs/rules/skill-invocation-unreachable.md).
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { readBoolean } from '../frontmatter-boolean.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'skill-invocation-unreachable' as const

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
        '`disable-model-invocation: true` means that Claude cannot invoke this skill on its own, and `user-invocable: false` means that the user cannot invoke it.',
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
