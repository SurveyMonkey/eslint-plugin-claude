// `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` are substituted only in
// plugin skills (docs/rules/skill-plugin-vars-outside-plugin.md).
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'skill-plugin-vars-outside-plugin' as const

const PLUGIN_VARIABLE = /\$\{CLAUDE_PLUGIN_(?:ROOT|DATA)\}/g

const rule: MarkdownRuleDefinition<{ MessageIds: 'literal' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use plugin variables in plugin skills only',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      literal: '`{{variable}}` is substituted in plugin skills only. Here it stays literal text.',
    },
  },
  create(context) {
    const file = classifySkillFile(context.filename)
    if (file === null || file.plugin) {
      return {}
    }
    const { sourceCode } = context
    /** Report each variable in the text from `start` to `end`. */
    const scan = (start: number, end: number) => {
      for (const match of sourceCode.text.slice(start, end).matchAll(PLUGIN_VARIABLE)) {
        const from = start + match.index
        context.report({
          loc: {
            start: sourceCode.getLocFromIndex(from),
            end: sourceCode.getLocFromIndex(from + match[0].length),
          },
          messageId: 'literal',
          data: { variable: match[0] },
        })
      }
    }
    return {
      root(node) {
        const first = node.children[0]
        let bodyStart = 0
        if (first?.type === 'yaml') {
          const fm = readFrontmatter(sourceCode, first)
          if (fm === null) {
            return
          }
          const tools = fm.fields.get('allowed-tools')
          if (tools !== undefined) {
            scan(fm.base + tools.valueStart, fm.base + tools.valueEnd)
          }
          bodyStart = sourceCode.getRange(first)[1]
        }
        scan(bodyStart, sourceCode.text.length)
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
