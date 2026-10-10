// A doubled backslash before an argument placeholder does not escape it. Both backslashes stay,
// and the placeholder still expands (docs/rules/skill-argument-escape.md). The docs give no
// exemption for code, so the rule reads fenced and inline code too.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { listEntries, SPACE_OR_COMMA } from '../frontmatter-list.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'skill-argument-escape' as const

/** The pattern for a pair of backslashes, and then `$` and a placeholder. A third backslash
 *  in front is not a doubled one. The docs do not say what it does, so the rule leaves it. */
function doubled(names: string[]): RegExp {
  const tokens = [
    '\\d+',
    'ARGUMENTS',
    ...names.map((n) => n.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  ]
  return new RegExp(String.raw`(?<!\\)\\\\\$(?:${tokens.join('|')})(?!\w)`, 'g')
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'doubled' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Escape an argument placeholder with one backslash, not two',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      doubled:
        'A doubled backslash does not escape `{{token}}`. Both backslashes stay, and the placeholder still expands. Use one backslash to keep it as text.',
    },
  },
  create(context) {
    if (classifySkillFile(context.filename) === null) {
      return {}
    }
    const { sourceCode } = context
    return {
      root(node) {
        const first = node.children[0]
        let names: string[] = []
        let start = 0
        if (first?.type === 'yaml') {
          const fm = readFrontmatter(sourceCode, first)
          start = sourceCode.getRange(first)[1]
          // YAML that does not parse gives no declared names. The built-in placeholders stay.
          if (fm !== null) {
            names = listEntries(fm, first.value, 'arguments', SPACE_OR_COMMA).map((e) => e.text)
          }
        }
        for (const match of sourceCode.text.slice(start).matchAll(doubled(names))) {
          const from = start + match.index
          context.report({
            loc: {
              start: sourceCode.getLocFromIndex(from),
              end: sourceCode.getLocFromIndex(from + match[0].length),
            },
            messageId: 'doubled',
            data: { token: match[0].slice(2) },
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
