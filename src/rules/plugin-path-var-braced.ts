// Claude Code substitutes `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` in
// the Markdown of a plugin skill, command and agent, and not the bare form
// (docs/rules/plugin-path-var-braced.md). The rule reports each bare variable in
// the body. It makes no report when it cannot see the plugin.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { docsUrl } from '../docs-url.ts'
import { readPluginAt } from '../plugin-manifest.ts'
import { classifySkillFile } from '../skill-files.ts'
import { scopeRoot } from '../skill-tree.ts'

const name = 'plugin-path-var-braced' as const

// The lookahead keeps a longer name, such as `$CLAUDE_PLUGIN_ROOT_DIR`, out.
const BARE = /\$(CLAUDE_PLUGIN_(?:ROOT|DATA))(?![A-Za-z0-9_])/g

/** The plugin root of a skill, command or agent file, or undefined when `file`
 *  is none of them, is not in a plugin, or sits in a plugin that is unseen. */
function pluginRootOf(file: string): string | undefined {
  const skill = classifySkillFile(file)
  if (skill !== null) {
    return skill.plugin ? scopeRoot(file, skill) : undefined
  }
  const agent = classifyAgentFile(file)
  return agent?.plugin === true ? agent.root : undefined
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'bare' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write the plugin path variables of plugin Markdown in the braced form',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      bare: 'Claude Code substitutes `{{braced}}` in plugin content and not `{{bare}}`. The bare form stays literal text, and a Bash command has no such variable. Write `{{braced}}`.',
    },
  },
  create(context) {
    const root = pluginRootOf(context.filename)
    if (root === undefined || readPluginAt(root) === undefined) {
      return {}
    }
    const { sourceCode } = context
    return {
      root(node) {
        // The frontmatter is not the body.
        const first = node.children[0]
        const start = first?.type === 'yaml' ? sourceCode.getRange(first)[1] : 0
        for (const match of sourceCode.text.slice(start).matchAll(BARE)) {
          const from = start + match.index
          context.report({
            loc: {
              start: sourceCode.getLocFromIndex(from),
              end: sourceCode.getLocFromIndex(from + match[0].length),
            },
            messageId: 'bare',
            data: { bare: match[0], braced: `\${${match[1]}}` },
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/SKILL.md', '**/commands/**/*.md', '**/agents/**/*.md'],
  rule,
}
