// `permissionMode: auto` in a local subagent has no effect when the settings lock auto mode off.
// The subagent then keeps the permission mode of the main conversation
// (docs/rules/agent-permission-mode-auto-unavailable.md).
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyLinted } from '../agent-files.ts'
import { docsUrl } from '../docs-url.ts'
import { AUTO_MODE_LOCKS, at } from '../permission-source.ts'
import { readSiblingSettings } from '../settings-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'agent-permission-mode-auto-unavailable' as const

/** The objects of `settings.json` and `settings.local.json` in the `.claude/` directory `dir`.
 *  The lock applies when any settings file sets it, so the rule reads each file alone and
 *  does not merge them. A file that is not there, or that the rule cannot read, adds
 *  nothing (ADR 001, Decision 14). */
function settingsFiles(dir: string): Record<string, unknown>[] {
  // `readSiblingSettings` reads the other settings file of the same `.claude/` directory, not the
  // file that it gets. So each call reads one file.
  return [
    ...readSiblingSettings(path.join(dir, 'settings.local.json')),
    ...readSiblingSettings(path.join(dir, 'settings.json')),
  ]
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'unavailable' }> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Do not set `permissionMode: auto` in a local agent when the settings turn auto mode off',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unavailable:
        'The settings set `{{key}}` to "disable", so auto mode is not available. The subagent keeps the permission mode of the main conversation.',
    },
  },
  create(context) {
    // Claude Code ignores `permissionMode` in a plugin agent.
    const agent = classifyLinted(context)
    if (agent === null || agent.plugin) {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const field = fm?.fields.get('permissionMode')
        if (fm === null || field === undefined || fm.data.permissionMode !== 'auto') {
          return
        }
        const files = settingsFiles(agent.root)
        // The lock is the string "disable", at the top level or in `permissions`.
        const lock = AUTO_MODE_LOCKS.find((lockPath) =>
          files.some((settings) => at(settings, lockPath) === 'disable'),
        )
        if (lock !== undefined) {
          context.report({
            loc: fm.at(field.valueStart, field.valueEnd),
            messageId: 'unavailable',
            data: { key: lock.join('.') },
          })
        }
      },
    }
  },
}

export const target = {
  name,
  language: 'markdown' as const,
  files: ['**/*.md'],
}

export default rule
