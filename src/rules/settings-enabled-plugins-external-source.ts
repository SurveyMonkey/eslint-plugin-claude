// Claude Code does not install a plugin for a teammate in one case. `.claude/settings.json` sets the
// plugin to `true`, and the plugin has an external source in a repository marketplace
// (docs/rules/settings-enabled-plugins-external-source.md). The rule finds the marketplace in the
// project settings (`declaredSource`). It reads the entries through `readEntrySources`, and makes
// no report when it cannot read the file.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { declaredSource, readEntrySources } from '../marketplace-file.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { keyForm } from './settings-enabled-plugins-schema.ts'

const name = 'settings-enabled-plugins-external-source' as const

/** True when `value` is an object source. A string source is a relative path, and the
 *  `marketplace-relative-source-*` rules own a string with a fault. */
const isExternal = (value: unknown) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'external' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Do not enable a plugin in .claude/settings.json when its marketplace entry has an external source',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      external:
        'The plugin "{{plugin}}" is enabled here, and its entry in the marketplace "{{marketplace}}" has an external source. Claude Code does not install it from the project settings alone. Each teammate must run "claude plugin install {{key}} --scope project", or the entry needs a relative path.',
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
          if (
            lastMember(enabled, key) !== member ||
            !keyForm(key) ||
            member.value.type !== 'Boolean' ||
            !member.value.value
          ) {
            continue
          }
          const [plugin = '', marketplace = ''] = key.split('@')
          const sources = readEntrySources(
            context.filename,
            declaredSource(context.filename, context.sourceCode.text, marketplace),
          )?.get(plugin)
          // Two entries of one name: Claude Code may take either, so the rule needs both external.
          if (sources?.every(isExternal)) {
            context.report({
              node: member.name,
              messageId: 'external',
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
  files: ['**/.claude/settings.json'],
  rule,
}
