// The marketplace part of an `enabledPlugins` key that is set to `true` in a project settings file
// should be declared in `extraKnownMarketplaces` there
// (docs/rules/settings-enabled-plugins-marketplace-declared.md). The rule is a heuristic and `off`:
// a user can add the marketplace in a file that the repository does not hold. It reads both project
// files through `declaredMarketplaces`, and makes no report when it cannot read one.
import type { JSONRuleDefinition } from '@eslint/json'
import { INTERNAL_MARKETPLACE_NAMES } from '../data/marketplace-reserved-names.ts'
import { docsUrl } from '../docs-url.ts'
import { declaredMarketplaces } from '../marketplace-file.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { UNREADABLE } from '../skill-tree.ts'
import { keyForm } from './settings-enabled-plugins-schema.ts'

const name = 'settings-enabled-plugins-marketplace-declared' as const

/** The marketplace that needs no declaration. A `name@claude-plugins-official` entry in
 *  `enabledPlugins` declares it (plugins/org, "Require a marketplace and its plugins"). The names
 *  in `INTERNAL_MARKETPLACE_NAMES` are the origins of plugins that come from no marketplace, such as
 *  `inline`, `skills-dir` and `synced` (plugins/loading, "Find where a plugin came from"). */
const NEEDS_NO_DECLARATION: readonly string[] = [
  'claude-plugins-official',
  ...INTERNAL_MARKETPLACE_NAMES,
]

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'undeclared' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Declare the marketplace of each enabled plugin in extraKnownMarketplaces of the committed settings',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      undeclared:
        'The "enabledPlugins" key "{{key}}" names the marketplace "{{marketplace}}", and no committed settings file declares it in "extraKnownMarketplaces". A teammate who has not added it gets no plugin.',
    },
  },
  create(context) {
    return {
      Document(node) {
        const enabled = lastMember(node.body, 'enabledPlugins')?.value
        if (enabled?.type !== 'Object') {
          return
        }
        const declared = declaredMarketplaces(context.filename, context.sourceCode.text)
        if (declared === UNREADABLE) {
          return
        }
        for (const member of enabled.members) {
          const key = keyOf(member.name)
          // Two members of one key read as the last, as `JSON.parse` does. A key that
          // `settings-enabled-plugins-schema` reports has no marketplace to read. A plugin set to
          // `false` is blocked, and needs no marketplace.
          if (
            lastMember(enabled, key) !== member ||
            !keyForm(key) ||
            member.value.type !== 'Boolean' ||
            !member.value.value
          ) {
            continue
          }
          const marketplace = key.split('@')[1] ?? ''
          if (!NEEDS_NO_DECLARATION.includes(marketplace) && !declared.has(marketplace)) {
            context.report({
              node: member.name,
              messageId: 'undeclared',
              data: { key, marketplace },
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
