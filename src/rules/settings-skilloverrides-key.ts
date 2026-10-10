// A `skillOverrides` key that Claude Code does not apply
// (docs/rules/settings-skilloverrides-key.md). The aliases are in `src/data/settings-keys.ts`.
import type { JSONRuleDefinition } from '@eslint/json'
import { BUNDLED_SKILL_ALIASES } from '../data/settings-keys.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-skilloverrides-key' as const

/** The namespace of the skills that Claude Code syncs from a claude.ai account. These are no
 *  plugin skills, and the docs do not say that `skillOverrides` skips them. */
const SYNCED_PREFIX = 'anthropic-skills:'

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'pluginSkill' | 'bundledAlias' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not set a skillOverrides key that Claude Code does not apply',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      pluginSkill:
        'Claude Code does not apply "skillOverrides" to plugin skills. The key "{{key}}" has no effect. Manage a plugin skill through /plugin.',
      bundledAlias:
        'In a project or local settings file, Claude Code matches "skillOverrides" keys against skill names only. "{{key}}" is an alias of the bundled skill "{{skill}}", so this entry does not reach it. Set the entry in managed settings or in a --settings file, or use "{{skill}}".',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    // An alias key applies in managed settings, so a managed file has nothing to report there.
    const isManaged = kindOf(context.filename) === 'managed'

    return {
      Document(node) {
        const overrides = lastMember(node.body, 'skillOverrides')?.value
        if (overrides?.type !== 'Object') {
          return
        }
        for (const member of overrides.members) {
          const key = keyOf(member.name)
          // Two keys of one name: the last counts, as in `JSON.parse`. A `null` value removes it.
          if (lastMember(overrides, key) !== member || member.value.type === 'Null') {
            continue
          }
          const skill = BUNDLED_SKILL_ALIASES.get(key)
          if (key.includes(':') && !key.startsWith(SYNCED_PREFIX)) {
            context.report({ node: member.name, messageId: 'pluginSkill', data: { key } })
          } else if (!isManaged && skill !== undefined) {
            context.report({ node: member.name, messageId: 'bundledAlias', data: { key, skill } })
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
