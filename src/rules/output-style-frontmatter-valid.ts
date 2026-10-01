// A style file with frontmatter that does not parse, or that is not at the
// start of the file, loads under its file name with no field set
// (docs/rules/output-style-frontmatter-valid.md). A style file without
// frontmatter is valid, because each field is optional.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyOutputStyle, OUTPUT_STYLE_FIELDS } from '../agent-files.ts'
import { docsUrl } from '../docs-url.ts'
import { parseFrontmatter } from '../frontmatter.ts'
import { lateFrontmatter } from '../late-frontmatter.ts'

const name = 'output-style-frontmatter-valid' as const

const rule: MarkdownRuleDefinition<{ MessageIds: 'notFirst' | 'invalidYaml' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Give an output style file frontmatter that Claude Code can read',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      notFirst:
        'This frontmatter block does not start on line 1. Claude Code loads the style with no field set.',
      invalidYaml:
        'The frontmatter is not YAML that gives a map of fields. Claude Code loads the style with no field set.',
    },
  },
  create(context) {
    if (classifyOutputStyle(context.filename) === null) {
      return {}
    }
    const { sourceCode } = context
    return {
      root() {
        const opening = lateFrontmatter(sourceCode, OUTPUT_STYLE_FIELDS)
        if (opening !== null) {
          context.report({
            loc: {
              start: { line: opening.line, column: 1 },
              end: { line: opening.line, column: opening.text.length + 1 },
            },
            messageId: 'notFirst',
          })
        }
      },
      yaml(node) {
        // Empty frontmatter sets no field, and that is valid.
        if (node.value.trim() !== '' && parseFrontmatter(node.value) === null) {
          context.report({ node, messageId: 'invalidYaml' })
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
