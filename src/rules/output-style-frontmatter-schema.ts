// The frontmatter fields of an output style file, with their types
// (docs/rules/output-style-frontmatter-schema.md). `force-for-plugin` works
// only in a plugin style.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyOutputStyle, OUTPUT_STYLE_FIELDS } from '../agent-files.ts'
import { docsUrl } from '../docs-url.ts'
import { isBooleanValue, nearMissOf } from '../frontmatter-values.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'output-style-frontmatter-schema' as const

const STRING_FIELDS = ['name', 'description']

const rule: MarkdownRuleDefinition<{
  MessageIds: 'unknownKey' | 'nearMiss' | 'pluginOnly' | 'wrongType' | 'rename'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use the frontmatter fields of an output style, with the right types',
      url: docsUrl(name),
    },
    hasSuggestions: true,
    schema: [],
    messages: {
      unknownKey: '`{{key}}` is not an output style frontmatter field. Claude Code ignores it.',
      nearMiss:
        '`{{key}}` is not an output style frontmatter field. Claude Code ignores it. Use `{{expected}}`.',
      pluginOnly: '`force-for-plugin` works only in the output style of a plugin.',
      wrongType: '`{{key}}` must be {{expected}}.',
      rename: 'Rename the key to `{{expected}}`.',
    },
  },
  create(context) {
    const style = classifyOutputStyle(context.filename)
    if (style === null) {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        if (fm === null) {
          return
        }
        for (const field of fm.fields.values()) {
          const { key } = field
          const keyLoc = fm.at(field.keyStart, field.keyEnd)
          if (!(OUTPUT_STYLE_FIELDS as readonly string[]).includes(key)) {
            const expected = nearMissOf(key, OUTPUT_STYLE_FIELDS)
            if (expected === undefined) {
              context.report({ loc: keyLoc, messageId: 'unknownKey', data: { key } })
            } else {
              context.report({
                loc: keyLoc,
                messageId: 'nearMiss',
                data: { key, expected },
                suggest: [
                  {
                    messageId: 'rename',
                    data: { expected },
                    fix: (fixer) =>
                      fixer.replaceTextRange(
                        [fm.base + field.keyStart, fm.base + field.keyEnd],
                        expected,
                      ),
                  },
                ],
              })
            }
            continue
          }
          if (key === 'force-for-plugin' && !style.plugin) {
            context.report({ loc: keyLoc, messageId: 'pluginOnly' })
          }
          const value = fm.data[key]
          // An empty value is the same as an absent field.
          if (value === null || value === undefined) {
            continue
          }
          const valid = STRING_FIELDS.includes(key)
            ? typeof value === 'string'
            : isBooleanValue(value)
          if (!valid) {
            context.report({
              loc: fm.at(field.valueStart, field.valueEnd),
              messageId: 'wrongType',
              data: { key, expected: STRING_FIELDS.includes(key) ? 'a string' : 'a Boolean' },
            })
          }
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
