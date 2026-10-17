// `permissionMode: auto` in a local subagent has no effect when the settings lock auto mode off.
// The subagent then keeps the permission mode of the main conversation
// (docs/rules/agent-permission-mode-auto-unavailable.md).
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { localAgentSettings } from '../agent-settings.ts'
import { docsUrl } from '../docs-url.ts'
import { at } from '../permission-source.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import { UNREADABLE } from '../skill-tree.ts'

const name = 'agent-permission-mode-auto-unavailable' as const

/** The places of the auto mode lock. The docs accept the key at the top level and in
 *  `permissions`, and its one value is the string "disable". */
const LOCKS = [['disableAutoMode'], ['permissions', 'disableAutoMode']] as const

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
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const field = fm?.fields.get('permissionMode')
        if (fm === null || field === undefined || fm.data.permissionMode !== 'auto') {
          return
        }
        const settings = localAgentSettings(context.filename)
        if (settings === null || settings === UNREADABLE) {
          return
        }
        const lock = LOCKS.find((path) => at(settings, path) === 'disable')
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
  files: ['**/agents/**/*.md'],
}

export default rule
