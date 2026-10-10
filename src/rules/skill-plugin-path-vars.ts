// A plugin skill names a plugin path with `${CLAUDE_PLUGIN_ROOT}` in the Markdown body. Claude
// Code substitutes it there (docs/rules/skill-plugin-path-vars.md). The rule is a heuristic. It
// reads the body only.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifySkillFile } from '../skill-files.ts'

const name = 'skill-plugin-path-vars' as const

// The braced variable, escaped so that the template literal keeps it as text.
const PLUGIN_ROOT = `\${CLAUDE_PLUGIN_ROOT}`

/** The plugin variable with no braces. Claude Code substitutes only the braced form, and the
 *  Bash tool does not have the variable in its environment. */
const UNBRACED = /\$(CLAUDE_PLUGIN_(?:ROOT|DATA))(?!\w)/g

/** A path that climbs out of the skill directory. In a skill folder `skills/<name>/`, the path
 *  leads to another part of the plugin. */
const CLIMB = /\$\{CLAUDE_SKILL_DIR\}\/\.\.(?![\w.-])/g

const rule: MarkdownRuleDefinition<{ MessageIds: 'unbraced' | 'climb' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Write a plugin path in a plugin skill with the braced plugin variable',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unbraced:
        '`{{found}}` is not substituted, and the Bash tool does not have it in its environment. Write `{{braced}}` in the Markdown body.',
      climb:
        'A path that climbs out of the skill directory with `{{found}}` depends on the plugin layout. Write `{{root}}/<path>` for a file elsewhere in the plugin.',
    },
  },
  create(context) {
    const file = classifySkillFile(context.filename)
    if (file?.kind !== 'skill' || !file.plugin) {
      return {}
    }
    const { sourceCode } = context
    return {
      root(node) {
        const first = node.children[0]
        // The text after the frontmatter. The block does not need to parse.
        const start = first?.type === 'yaml' ? sourceCode.getRange(first)[1] : 0
        const body = sourceCode.text.slice(start)
        for (const [pattern, messageId] of [
          [UNBRACED, 'unbraced'],
          [CLIMB, 'climb'],
        ] as const) {
          for (const match of body.matchAll(pattern)) {
            const from = start + match.index
            context.report({
              loc: {
                start: sourceCode.getLocFromIndex(from),
                end: sourceCode.getLocFromIndex(from + match[0].length),
              },
              messageId,
              data: {
                found: match[0],
                braced: `\${${match[1] ?? ''}}`,
                root: PLUGIN_ROOT,
              },
            })
          }
        }
      },
    }
  },
}

export default { name, language: 'markdown' as const, files: ['**/SKILL.md'], rule }
