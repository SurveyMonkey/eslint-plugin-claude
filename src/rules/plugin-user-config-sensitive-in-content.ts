// Claude Code writes a placeholder for `${user_config.KEY}` in skill and agent content when the
// option is `sensitive`, and not the value (docs/rules/plugin-user-config-sensitive-in-content.md).
// The rule reports each such reference in the body. It makes no report when it cannot see the plugin.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { docsUrl } from '../docs-url.ts'
import { readPluginAt } from '../plugin-manifest.ts'
import { classifySkillFile } from '../skill-files.ts'
import { scopeRoot } from '../skill-tree.ts'

const name = 'plugin-user-config-sensitive-in-content' as const

// A key is made of letters, digits and underscores (manifest reference, "User configuration").
const REFERENCE = /\$\{user_config\.([A-Za-z0-9_]+)\}/g

/** The plugin root of a skill or agent file, or undefined when `file` is neither, is not in a
 *  plugin, or sits in a plugin that is unseen. The docs name skill and agent content, so a
 *  command file gives undefined. */
function pluginRootOf(file: string): string | undefined {
  const skill = classifySkillFile(file)
  if (skill !== null) {
    return skill.plugin && skill.kind === 'skill' ? scopeRoot(file, skill) : undefined
  }
  const agent = classifyAgentFile(file)
  return agent?.plugin === true ? agent.root : undefined
}

/** True when `options`, the `userConfig` value of a manifest, declares `key` with `sensitive: true`. */
function isSensitive(options: unknown, key: string): boolean {
  if (options === null || typeof options !== 'object') {
    return false
  }
  // A key of the prototype is a function or an object with no `sensitive` member.
  const option = (options as Record<string, unknown>)[key]
  return (
    option !== null &&
    typeof option === 'object' &&
    (option as { sensitive?: unknown }).sensitive === true
  )
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'placeholder' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Keep the reference to a sensitive plugin option out of skill and agent content',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      placeholder:
        'The option `{{key}}` is sensitive, so Claude Code writes a placeholder for `{{reference}}` in skill and agent content, and not the value. Pass the value to a hook, an MCP server or an LSP server.',
    },
  },
  create(context) {
    const root = pluginRootOf(context.filename)
    const plugin = root === undefined ? undefined : readPluginAt(root)
    if (plugin === undefined) {
      return {}
    }
    const { sourceCode } = context
    return {
      root(node) {
        // The frontmatter is not the content.
        const first = node.children[0]
        const start = first?.type === 'yaml' ? sourceCode.getRange(first)[1] : 0
        for (const match of sourceCode.text.slice(start).matchAll(REFERENCE)) {
          const key = match[1] as string
          if (!isSensitive(plugin.fields.userConfig, key)) {
            continue
          }
          const from = start + match.index
          context.report({
            loc: {
              start: sourceCode.getLocFromIndex(from),
              end: sourceCode.getLocFromIndex(from + match[0].length),
            },
            messageId: 'placeholder',
            data: { key, reference: match[0] },
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/SKILL.md', '**/agents/**/*.md'],
  rule,
}
