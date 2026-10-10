// A marketplace key alias in a settings file (docs/rules/settings-marketplace-key-alias.md).
// Claude Code before v2.1.232 ignores `additionalMarketplaces` and `allowedMarketplaces`. The rule
// reports the alias key. Two other rules own two cases, so one fault gets one report. The conflict
// rule owns an alias beside its canonical key. `settings-key-scope` owns `allowedMarketplaces` in a
// project file, because `strictKnownMarketplaces` is a managed key.
import type { JSONRuleDefinition } from '@eslint/json'
import { MARKETPLACE_KEY_ALIASES, settingsKeyScope } from '../data/settings-keys.ts'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-marketplace-key-alias' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'alias' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Write extraKnownMarketplaces and strictKnownMarketplaces, not their aliases additionalMarketplaces and allowedMarketplaces',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      alias:
        'Write "{{canonical}}", not the alias "{{alias}}". Claude Code before v2.1.232 ignores the alias.',
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
          const member = lastMember(node.body, alias)
          if (
            member === undefined ||
            // The conflict rule reports an alias beside its canonical key.
            lastMember(node.body, canonical) !== undefined ||
            // A project file does not accept a managed key, so `settings-key-scope` reports it.
            (!managed && settingsKeyScope([canonical])?.scope === 'managed')
          ) {
            continue
          }
          context.report({ node: member.name, messageId: 'alias', data: { alias, canonical } })
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
