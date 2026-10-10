// A `pluginSuggestionMarketplaces` name needs its source in the same managed
// settings (docs/rules/settings-plugin-suggestion-marketplaces-source.md). The
// managed settings page merges `managed-settings.json` and each
// `managed-settings.d/*.json` drop-in into one source. The rule reads the text
// of the linted file, and the sibling files through `readManagedSource`.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES, readManagedSource } from '../settings-files.ts'
import { UNREADABLE } from '../skill-tree.ts'

const name = 'settings-plugin-suggestion-marketplaces-source' as const

/** The official marketplace. Its name alone suffices, because that name can only register from
 *  the official Anthropic source (the settings reference, `pluginSuggestionMarketplaces`). */
const OFFICIAL = 'claude-plugins-official'

type Fields = Record<string, unknown>

const isObject = (value: unknown): value is Fields =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** True when `fields` sets `managedSourcesBehavior` to "merge". */
const merges = (fields: Fields) => fields.managedSourcesBehavior === 'merge'

/** True when `fields` declares the marketplace `market`. Two things declare it. One is an
 *  `extraKnownMarketplaces` key of that name with a value other than null. The other is a
 *  `strictKnownMarketplaces` list with at least one entry. A policy entry is a source pattern,
 *  so the rule cannot tell which entry matches a name. With both spellings of a key, Claude Code
 *  uses the canonical key and ignores the alias. */
function declares(fields: Fields, market: string): boolean {
  const registered = fields.extraKnownMarketplaces ?? fields.additionalMarketplaces
  const allowed = fields.strictKnownMarketplaces ?? fields.allowedMarketplaces
  return (
    (isObject(registered) && Object.hasOwn(registered, market) && registered[market] !== null) ||
    (Array.isArray(allowed) && allowed.length > 0)
  )
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'undeclared' }> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Declare the source of each pluginSuggestionMarketplaces name in managed settings',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      undeclared:
        'The "pluginSuggestionMarketplaces" name "{{name}}" takes effect only when the same managed settings declare its source. Add an "extraKnownMarketplaces" entry of that name, or a "strictKnownMarketplaces" entry.',
    },
  },
  create(context) {
    return {
      Document(node) {
        // Claude Code ignores a hidden drop-in, so it reads no key there.
        if (isHiddenDropIn(context.filename)) {
          return
        }
        const names = lastMember(node.body, 'pluginSuggestionMarketplaces')?.value
        if (names?.type !== 'Array') {
          return
        }
        // The top level has the key, so it is an object. Text that `JSON.parse` rejects, such as a
        // comment in a JSONC file, is text that the rule cannot see.
        let own: Fields
        try {
          own = JSON.parse(context.sourceCode.text) as Fields
        } catch {
          return
        }
        const siblings = readManagedSource(context.filename)
        // A part that the rule cannot see can declare the name, or set "merge".
        if (siblings === UNREADABLE) {
          return
        }
        const source = [own, ...siblings]
        // The rule cannot tell which sources "merge" joins to this one. The repository does not
        // hold them.
        if (source.some(merges)) {
          return
        }
        for (const { value } of names.elements) {
          if (
            value.type === 'String' &&
            value.value !== OFFICIAL &&
            !source.some((fields) => declares(fields, value.value))
          ) {
            context.report({ node: value, messageId: 'undeclared', data: { name: value.value } })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: MANAGED_SETTINGS_FILES,
  rule,
}
