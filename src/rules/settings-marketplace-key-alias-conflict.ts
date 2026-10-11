// A settings file that sets a marketplace key and its alias. Claude Code uses the canonical value
// and ignores the alias (docs/rules/settings-marketplace-key-alias-conflict.md). A key counts as
// set for any value, as the docs name no value that Claude Code reads differently. A project file
// gets the pair `extraKnownMarketplaces` and `additionalMarketplaces`. A managed file gets that
// pair too, and the pair `strictKnownMarketplaces` and `allowedMarketplaces`. The settings reference
// gives `strictKnownMarketplaces` the scope "Managed", so a project file does not accept it.
import type { JSONRuleDefinition } from '@eslint/json'
import { MARKETPLACE_KEY_ALIASES, settingsKeyScope } from '../data/settings-keys.ts'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-marketplace-key-alias-conflict' as const

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
        // Claude Code ignores a hidden drop-in, so it reads no key there.
        if (isHiddenDropIn(context.filename)) {
          return
        }
        const managed = kindOf(context.filename) === 'managed'
        for (const [alias, canonical] of Object.entries(MARKETPLACE_KEY_ALIASES)) {
          // Only a managed file accepts a managed key.
          if (!managed && settingsKeyScope([canonical])?.scope === 'managed') {
            continue
          }
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
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}
