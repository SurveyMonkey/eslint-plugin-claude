// A `SKILL.md` at the plugin root with no `name`. A marketplace install then names the skill
// after its cache directory (docs/rules/skill-plugin-root-name.md). A root that the check
// cannot see gives no report, because `classifySkillFile` gives null for it.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { isEmptyBlock } from '../empty-block.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'skill-plugin-root-name' as const

const rule: MarkdownRuleDefinition<{ MessageIds: 'missing' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Set a name on the SKILL.md at the root of a plugin',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      missing:
        '`name` is missing or empty. A marketplace install names this skill after its cache directory, not after the plugin. Set `name`.',
    },
  },
  create(context) {
    const file = classifySkillFile(context.filename)
    // Only a plugin-root skill has no folder name. Its `name` is the only name.
    if (file === null || file.kind !== 'skill' || !file.plugin || file.names.length > 0) {
      return {}
    }
    return {
      root(node) {
        const first = node.children[0]
        let loc = { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } }
        if (first?.type === 'yaml') {
          const fm = readFrontmatter(context.sourceCode, first)
          // YAML that does not parse is a fault of another rule. A block with no content has no
          // `name`.
          if (fm === null && !isEmptyBlock(first.value)) {
            return
          }
          const value = fm?.data.name
          // A value that is not a string is a fault of the schema rule.
          if (
            typeof value === 'string' ? value.trim() !== '' : value !== null && value !== undefined
          ) {
            return
          }
          const field = fm?.fields.get('name')
          loc =
            fm && field ? fm.at(field.keyStart, field.valueEnd) : context.sourceCode.getLoc(first)
        }
        context.report({ loc, messageId: 'missing' })
      },
    }
  },
}

export default { name, language: 'markdown' as const, files: ['**/SKILL.md'], rule }
