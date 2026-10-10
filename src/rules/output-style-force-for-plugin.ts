// `force-for-plugin: true` in a plugin output style applies the style to each
// user who enables the plugin, and it overrides their `outputStyle` setting
// (docs/rules/output-style-force-for-plugin.md). The field works only in a
// plugin style. `output-style-frontmatter-schema` reports it in a local style.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyOutputStyle } from '../agent-files.ts'
import { docsUrl } from '../docs-url.ts'
import { readBoolean } from '../frontmatter-boolean.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'output-style-force-for-plugin' as const

const rule: MarkdownRuleDefinition<{ MessageIds: 'forced' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not force the output style of a plugin on each user',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      forced:
        '`force-for-plugin: true` applies this style to each user who enables the plugin. It overrides their `outputStyle` setting. If several plugins force a style, Claude Code uses the first one loaded. Set it only if the plugin needs the style.',
    },
  },
  create(context) {
    if (classifyOutputStyle(context.filename)?.plugin !== true) {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const field = fm?.fields.get('force-for-plugin')
        if (
          fm !== null &&
          field !== undefined &&
          readBoolean(fm.data['force-for-plugin']) === true
        ) {
          context.report({ loc: fm.at(field.valueStart, field.valueEnd), messageId: 'forced' })
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
