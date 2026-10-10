// A `skillOverrides` key that Claude Code does not apply
// (docs/rules/settings-skilloverrides-key.md). The aliases are in `src/data/settings-keys.ts`.
// A key with a colon is a plugin skill only when `enabledPlugins` of the file enables that plugin.
import { lstatSync } from 'node:fs'
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { BUNDLED_SKILL_ALIASES } from '../data/settings-keys.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember, type ValueNode } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-skilloverrides-key' as const

/** The names of the plugins that `enabledPlugins` lists, apart from a plugin set to `false`. A
 *  key has the form `plugin@marketplace`. */
function pluginNames(settings: ValueNode | undefined): Set<string> {
  const names = new Set<string>()
  const enabled = lastMember(settings, 'enabledPlugins')?.value
  if (enabled?.type === 'Object') {
    for (const member of enabled.members) {
      const key = keyOf(member.name)
      const value = member.value
      if (
        lastMember(enabled, key) === member &&
        value.type !== 'Null' &&
        !(value.type === 'Boolean' && !value.value)
      ) {
        names.add(key.replace(/@.*$/, ''))
      }
    }
  }
  return names
}

/** True when `base` holds a skill or a command of the name `key`: a path that exists, or a link
 *  that leads nowhere. The rule cannot see a link that leads nowhere, so it counts as present. */
function hasLocalSkill(base: string, key: string): boolean {
  return [`skills/${key}`, `commands/${key}`, `commands/${key}.md`].some((entry) => {
    try {
      lstatSync(path.join(base, entry))
      return true
    } catch {
      return false
    }
  })
}

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
        const plugins = pluginNames(node.body)
        for (const member of overrides.members) {
          const key = keyOf(member.name)
          // Two keys of one name: the last counts, as in `JSON.parse`. A `null` value removes it.
          if (lastMember(overrides, key) !== member || member.value.type === 'Null') {
            continue
          }
          const skill = BUNDLED_SKILL_ALIASES.get(key)
          // A name with a colon can be a plugin skill, a command in a subfolder of
          // `.claude/commands/`, or a nested skill. Only a plugin that this file enables is certain.
          if (key.includes(':')) {
            if (plugins.has(key.slice(0, key.indexOf(':')))) {
              context.report({ node: member.name, messageId: 'pluginSkill', data: { key } })
            }
          } else if (
            !isManaged &&
            skill !== undefined &&
            !hasLocalSkill(path.dirname(context.filename), key)
          ) {
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
