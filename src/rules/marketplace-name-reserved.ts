// Claude Code refuses a marketplace name that it reserves
// (docs/rules/marketplace-name-reserved.md).
import type { JSONRuleDefinition } from '@eslint/json'
import {
  ANTHROPIC_MARKETPLACE_NAMES,
  CLAUDEAI_PREFIX,
  INTERNAL_MARKETPLACE_NAMES,
  PACKAGE_MANAGER_NAMES,
} from '../data/marketplace-reserved-names.ts'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'

const name = 'marketplace-name-reserved' as const

type Options = [{ allowOfficial: boolean }]
type MessageIds = 'official' | 'spelling' | 'internal' | 'packageManager' | 'claudeaiPrefix'

/** An ASCII symbol other than a hyphen and an underscore. */
const SPELLING_SYMBOL = /[!-,./:-@[-^`{-~]/

/** True when `name` is another spelling of `reserved`. It has no other
 *  difference than one trailing dot, and a symbol other than an underscore in
 *  place of a hyphen. The docs do not fold letter case here, so the letters
 *  must match. */
export function isSpellingOf(name: string, reserved: string): boolean {
  const candidates = name.endsWith('.') ? [name, name.slice(0, -1)] : [name]
  return candidates.some(
    (candidate) =>
      candidate.length === reserved.length &&
      [...reserved].every(
        (letter, index) =>
          candidate[index] === letter ||
          (letter === '-' && SPELLING_SYMBOL.test(candidate[index] as string)),
      ),
  )
}

const rule: JSONRuleDefinition<{ RuleOptions: Options; MessageIds: MessageIds }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not give a marketplace a name that Claude Code reserves',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { allowOfficial: { type: 'boolean' } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allowOfficial: false }],
    messages: {
      official:
        'The marketplace name "{{name}}" is reserved for Anthropic marketplaces. Claude Code accepts it only for a source under github.com/anthropics/.',
      spelling:
        'The marketplace name "{{name}}" is another spelling of "{{reserved}}", a reserved name. Claude Code refuses it.',
      internal: 'The marketplace name "{{name}}" is a reserved name. Claude Code refuses it.',
      packageManager:
        'The marketplace name "{{name}}" is a package-manager name. Claude Code reserves it in any letter case.',
      claudeaiPrefix:
        'The marketplace name "{{name}}" starts with "claudeai-". Claude Code reserves that prefix for marketplaces that claude.ai hosts.',
    },
  },
  create(context) {
    const [{ allowOfficial }] = context.options
    return {
      Document(node) {
        // A `name` that is not a string is for the rule `marketplace-schema`.
        const value = lastMember(node.body, 'name')?.value
        if (value?.type !== 'String') {
          return
        }
        const text = value.value
        const report = (messageId: MessageIds, reserved = '') =>
          context.report({ node: value, messageId, data: { name: text, reserved } })
        if (ANTHROPIC_MARKETPLACE_NAMES.includes(text)) {
          // `allowOfficial` is for a repository under github.com/anthropics/.
          if (!allowOfficial) {
            report('official')
          }
          return
        }
        if (INTERNAL_MARKETPLACE_NAMES.includes(text)) {
          report('internal')
        } else if (PACKAGE_MANAGER_NAMES.includes(text.toLowerCase())) {
          report('packageManager')
        } else if (text.startsWith(CLAUDEAI_PREFIX)) {
          report('claudeaiPrefix')
        } else {
          const reserved = ANTHROPIC_MARKETPLACE_NAMES.find((name) => isSpellingOf(text, name))
          if (reserved !== undefined) {
            report('spelling', reserved)
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/marketplace.json'],
  rule,
}
