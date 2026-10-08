// A settings file that sets a marketplace key and its alias. Claude Code uses
// the canonical value and ignores the alias
// (docs/rules/settings-marketplace-key-alias-conflict.md). A key counts as set
// for any value, as the docs name no value that Claude Code reads differently.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'

const name = 'settings-marketplace-key-alias-conflict' as const

/** Each canonical key with its alias, in the order of the docs. */
const PAIRS = [
  { canonical: 'extraKnownMarketplaces', alias: 'additionalMarketplaces' },
  { canonical: 'strictKnownMarketplaces', alias: 'allowedMarketplaces' },
] as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'conflict' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not set a marketplace key and its alias in one settings file',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      conflict:
        'This file sets "{{alias}}" and "{{canonical}}". Claude Code uses the value of "{{canonical}}" and ignores "{{alias}}".',
    },
  },
  create(context) {
    return {
      Document(node) {
        for (const { canonical, alias } of PAIRS) {
          const aliasMember = lastMember(node.body, alias)
          if (aliasMember !== undefined && lastMember(node.body, canonical) !== undefined) {
            context.report({
              node: aliasMember.name,
              messageId: 'conflict',
              data: { alias, canonical },
            })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: SETTINGS_FILES,
  rule,
}
