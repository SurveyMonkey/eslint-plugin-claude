// A plugin output style sets `name` and `description` in its frontmatter
// (docs/rules/output-style-plugin-name-description.md). A style with no
// frontmatter loads under its file name, and lacks both fields. A wrong type is
// for `output-style-frontmatter-schema`. Frontmatter that does not parse, or
// that is not on line 1, is for `output-style-frontmatter-valid`.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyOutputStyle } from '../agent-files.ts'
import { OUTPUT_STYLE_FIELDS } from '../data/agent-fields.ts'
import { docsUrl } from '../docs-url.ts'
import { lateFrontmatter } from '../late-frontmatter.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'output-style-plugin-name-description' as const

const REQUIRED = ['name', 'description']

/** True when the field has no value: absent, empty, or only spaces. */
function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'missing' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Set name and description in the frontmatter of a plugin output style',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      missing:
        'A plugin output style sets `name` and `description`. This file sets no {{fields}}. The style then appears under its file name, with no description.',
    },
  },
  create(context) {
    if (classifyOutputStyle(context.filename)?.plugin !== true) {
      return {}
    }
    const { sourceCode } = context
    return {
      root(node) {
        const first = node.children[0]
        let data: Record<string, unknown> = {}
        let loc = { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } }
        if (first?.type === 'yaml') {
          loc = sourceCode.getLoc(first)
          // Empty frontmatter sets no field. Other YAML that does not parse is not for this rule.
          if (first.value.trim() !== '') {
            const fm = readFrontmatter(sourceCode, first)
            if (fm === null) {
              return
            }
            data = fm.data
          }
        } else if (lateFrontmatter(sourceCode, OUTPUT_STYLE_FIELDS) !== null) {
          return
        }
        const missing = REQUIRED.filter((key) => isBlank(data[key]))
        if (missing.length > 0) {
          context.report({
            loc,
            messageId: 'missing',
            data: { fields: missing.map((key) => `\`${key}\``).join(' or ') },
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/output-styles/*.md'],
  rule,
}
