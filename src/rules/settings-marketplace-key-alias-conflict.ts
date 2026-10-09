// A project settings file that sets `extraKnownMarketplaces` and its alias.
// Claude Code uses the canonical value and ignores the alias
// (docs/rules/settings-marketplace-key-alias-conflict.md). A key counts as set
// for any value, as the docs name no value that Claude Code reads differently.
// The pair `strictKnownMarketplaces` and `allowedMarketplaces` is not here:
// the settings reference gives `strictKnownMarketplaces` the scope "Managed",
// so a project file does not accept it.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'

const name = 'settings-marketplace-key-alias-conflict' as const

/** The canonical key and its alias. */
const PAIRS = [{ canonical: 'extraKnownMarketplaces', alias: 'additionalMarketplaces' }] as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'conflict' }> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Do not set extraKnownMarketplaces and its alias additionalMarketplaces in one settings file',
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
