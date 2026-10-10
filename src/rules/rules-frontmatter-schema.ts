// The frontmatter of a rule file in `.claude/rules/` (docs/rules/rules-frontmatter-schema.md).
// Claude Code reads one field, `paths`, as a YAML list or a comma-separated string. It ignores
// any other field with no error. If the YAML does not parse, it ignores the frontmatter and
// loads the rule with no `paths`. It reads the frontmatter only when the opening `---` is
// line 1.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { lateFrontmatter } from '../late-frontmatter.ts'
import { classifyMemoryFile } from '../memory-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'rules-frontmatter-schema' as const

const rule: MarkdownRuleDefinition<{
  MessageIds: 'notFirst' | 'invalidYaml' | 'unknownKey' | 'wrongType'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Give a rule file the frontmatter that Claude Code reads',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      notFirst:
        'This frontmatter block does not start on line 1. Claude Code reads it as rule text, and sets no `paths`.',
      invalidYaml:
        'The frontmatter is not YAML that gives a map of fields. Claude Code ignores it, and loads the rule with no `paths`. A glob that starts with `*` needs quotes.',
      unknownKey:
        '`{{key}}` is not a rule frontmatter field. Claude Code ignores it. The only field is `paths`.',
      wrongType: '`paths` must be a list of strings or one comma-separated string.',
    },
  },
  create(context) {
    if (classifyMemoryFile(context.filename) !== 'rule') {
      return {}
    }
    const { sourceCode } = context
    return {
      root() {
        const opening = lateFrontmatter(sourceCode, ['paths'])
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
        // A block of blank lines and YAML comments sets no field, as an empty block does not.
        if (node.value.split('\n').every((line) => /^\s*(#.*)?$/.test(line))) {
          return
        }
        const fm = readFrontmatter(sourceCode, node)
        if (fm === null) {
          context.report({ node, messageId: 'invalidYaml' })
          return
        }
        for (const field of fm.fields.values()) {
          if (field.key !== 'paths') {
            context.report({
              loc: fm.at(field.keyStart, field.keyEnd),
              messageId: 'unknownKey',
              data: { key: field.key },
            })
            continue
          }
          const value = fm.data.paths
          // An empty value is the same as an absent field.
          const valid =
            value === null ||
            typeof value === 'string' ||
            (Array.isArray(value) && value.every((item) => typeof item === 'string'))
          if (!valid) {
            context.report({ loc: fm.at(field.valueStart, field.valueEnd), messageId: 'wrongType' })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/.claude/rules/**/*.md'],
  rule,
}
