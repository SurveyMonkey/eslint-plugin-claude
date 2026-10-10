// A link under a plugin whose target is out of the marketplace is skipped when
// Claude Code copies the plugin (docs/rules/plugin-symlink-escapes-marketplace.md).
// The rule walks the plugin on disk with `escapingLinks` and reports each link
// that leads out of the marketplace root. It makes no report for a link that it
// cannot follow, and for a link that leads out of the repository.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { escapingLinks } from '../plugin-links.ts'
import { isSkillsPlugin, readPlugin } from '../plugin-manifest.ts'

const name = 'plugin-symlink-escapes-marketplace' as const

const rule: JSONRuleDefinition<{ MessageIds: 'escapes' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Keep the target of a link under a plugin inside the marketplace',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      escapes:
        'The link "{{file}}" leads to "{{target}}", out of the marketplace. Claude Code skips it when it copies the plugin, so the target is missing from the installed copy. Keep the target inside the marketplace.',
    },
  },
  create(context) {
    // A plugin in `.claude/skills/<name>` loads in place, so no install copies it.
    const plugin = isSkillsPlugin(context.filename) ? undefined : readPlugin(context.filename)
    return {
      Document(node) {
        if (plugin === undefined) {
          return
        }
        for (const { file, reach, target } of escapingLinks(plugin)) {
          if (reach === 'outside') {
            context.report({ node, messageId: 'escapes', data: { file, target } })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/plugin.json'],
  rule,
}
