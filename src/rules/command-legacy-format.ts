// A command file is the legacy form of a skill (docs/rules/command-legacy-format.md).
// The glob is broad, so the rule itself checks where the `commands/`
// directory is: `.claude/commands/`, or `commands/` at the root of a plugin.
// It finds a plugin root by its manifest.
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { isPluginRoot } from '../plugin-root.ts'
import { UNREADABLE } from '../skill-tree.ts'

const name = 'command-legacy-format' as const

/** True when `file` is under `.claude/commands/`, or under `commands/`
 *  next to `.claude-plugin/plugin.json`. The walk stops at a plugin root that
 *  the rule cannot see, and gives false. */
function isCommandFile(file: string): boolean {
  const parts = path.resolve(file).split(path.sep)
  for (let i = 1; i < parts.length - 1; i++) {
    if (parts[i] !== 'commands') {
      continue
    }
    const parent = parts.slice(0, i).join(path.sep) || path.sep
    if (parts[i - 1] === '.claude') {
      return true
    }
    const root = isPluginRoot(parent)
    if (root === UNREADABLE) {
      return false
    }
    if (root) {
      return true
    }
  }
  return false
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'legacy' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Use a skill, not the legacy command format',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      legacy:
        'Commands are the legacy form of a skill. Move this file to `skills/<name>/SKILL.md`.',
    },
  },
  create(context) {
    return {
      root(node) {
        if (isCommandFile(context.filename)) {
          context.report({ node, messageId: 'legacy' })
        }
      },
    }
  },
}

export default { name, language: 'markdown' as const, files: ['**/commands/**/*.md'], rule }
