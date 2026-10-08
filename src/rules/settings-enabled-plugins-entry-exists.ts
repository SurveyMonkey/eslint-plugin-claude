// The plugin part of an `enabledPlugins` key `plugin@marketplace` must be the
// `name` of an entry in the `marketplace.json` that the marketplace names in
// `extraKnownMarketplaces` (docs/rules/settings-enabled-plugins-entry-exists.md).
// The rule finds the marketplace in the same settings file first, then in the
// other project settings file. It reads the file through `readMarketplaceFile`,
// and makes no report when it cannot read it.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { declaredSource, readMarketplaceFile } from '../marketplace-file.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { keyForm } from './settings-enabled-plugins-schema.ts'

const name = 'settings-enabled-plugins-entry-exists' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'missing' }> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enable a plugin by the name of an entry in the marketplace.json of its marketplace',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      missing:
        'The "enabledPlugins" key "{{key}}" names the plugin "{{plugin}}", and the marketplace.json of "{{marketplace}}" has no entry with that "name". The docs say that the entry "name" is the key that "enabledPlugins" takes.',
    },
  },
  create(context) {
    return {
      Document(node) {
        const enabled = lastMember(node.body, 'enabledPlugins')?.value
        if (enabled?.type !== 'Object') {
          return
        }
        for (const member of enabled.members) {
          const key = keyOf(member.name)
          // Two members of one key read as the last, as `JSON.parse` does. A key that
          // `settings-enabled-plugins-schema` reports has no plugin and marketplace to read.
          if (lastMember(enabled, key) !== member || !keyForm(key)) {
            continue
          }
          const [plugin = '', marketplace = ''] = key.split('@')
          const read = readMarketplaceFile(
            context.filename,
            declaredSource(context.filename, context.sourceCode.text, marketplace),
          )
          if (read.kind === 'marketplace' && read.entries?.includes(plugin) === false) {
            context.report({
              node: member.name,
              messageId: 'missing',
              data: { key, plugin, marketplace },
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
